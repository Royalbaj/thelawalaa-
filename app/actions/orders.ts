"use server";

import crypto from "crypto";
import { after } from "next/server";
import { checkStockAfterSale } from "@/lib/stock-alerts";
import { orderSchema } from "@/lib/validations/order";
import { getVerifiedUser } from "@/lib/supabase/server";
import { supabaseAdmin, audit, resolveStaffBranchId, getRewardSettings } from "@/lib/supabase/admin";
import { redeemPlan, pointsForTotal, fmtPoints, fmtRupees } from "@/lib/rewards";
import { sendEmail, FROM_ORDERS } from "@/lib/email";
import { orderConfirmedEmail } from "@/lib/account-emails";
import { applyOpeningPromoPrice } from "@/lib/promo";
import { pushToStaff } from "@/lib/push";
import { npr } from "@/lib/utils";

function hashOtp(otp: string, orderId: string) {
  return crypto
    .createHmac("sha256", process.env.OTP_HMAC_SECRET!)
    .update(`${orderId}:${otp}`)
    .digest("hex");
}

// USP: flat Nrs 20 home delivery within 5km of the store (Godam Chowk, Banepa at launch).
const DELIVERY_FEE = 20; // NPR — flat

/**
 * Creates an order. Security properties:
 *  - Caller verified via getUser(), role checked from DB.
 *  - Every price comes from the products table — client totals are ignored.
 *  - Promo codes validated + atomically consumed with the service role
 *    (no client read access to promo_codes, so codes can't be enumerated).
 *  - Delivery OTP generated server-side, only its HMAC is stored.
 *  - No payment gateway (Nepal): every order starts payment_status
 *    'pending' and flips to 'paid' ONLY when an admin confirms the
 *    cash/QR payment via markOrderPaid — never from the client.
 */
export async function createOrder(input: unknown) {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid order data" };
  const data = parsed.data;

  const { data: settings } = await supabaseAdmin.from("app_settings").select("*").eq("id", 1).single();
  if (data.type === "delivery" && !settings?.delivery_enabled) {
    return { error: "Delivery isn't available right now — please choose pickup" };
  }
  if (data.payment_method === "esewa" && !settings?.esewa_enabled) {
    return { error: "eSewa isn't available right now — please choose cash or QR" };
  }

  const { user, profile } = await getVerifiedUser();
  const isStaff = user && profile && ["super_admin", "pos_user"].includes(profile.role);
  const isSelfCheckout = user && profile && profile.role === "customer";
  const isAnonymous = !user;

  if (isAnonymous && (!data.guest_name || !data.guest_phone)) {
    return { error: "Please provide your name and phone number to order" };
  }
  if (isStaff && !data.guest_name) {
    return { error: "Please provide a customer name" };
  }

  // ── Re-price everything server-side ──────────────────────────
  const ids = data.items.map((i) => i.product_id);
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name, price, is_available, pos_only, categories(name)")
    .in("id", ids);

  if (!products || products.length !== new Set(ids).size) {
    return { error: "Some items are no longer on the menu" };
  }
  // POS-only items aren't sold online (the website never lists them).
  const counterOnly = !isStaff && products.find((p) => p.pos_only);
  if (counterOnly) return { error: `"${counterOnly.name}" is only available at the counter` };
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const item of data.items) {
    const p = byId.get(item.product_id);
    if (!p || !p.is_available) return { error: `"${p?.name ?? "An item"}" is sold out` };
  }

  let subtotal = 0;
  const itemRows = data.items.map((i) => {
    const p = byId.get(i.product_id)!;
    const effectivePrice = applyOpeningPromoPrice(Number(p.price), (p.categories as any)?.name, settings);
    const line = effectivePrice * i.quantity;
    subtotal += line;
    return {
      product_id: p.id,
      product_name: p.name,
      product_price: effectivePrice,
      quantity: i.quantity,
      customization_notes: i.customization_notes ?? null,
      line_total: line,
    };
  });

  // Verify the delivery address belongs to THIS customer
  if (data.type === "delivery" && isSelfCheckout && data.delivery_address_id) {
    const { data: addr } = await supabaseAdmin
      .from("addresses")
      .select("id, customer_id")
      .eq("id", data.delivery_address_id)
      .single();
    if (!addr || addr.customer_id !== user?.id) return { error: "Invalid delivery address" };
  } else if (data.type === "delivery" && (isAnonymous || isStaff) && !data.guest_address) {
    return { error: "Please provide a delivery address" };
  }

  const delivery_fee = data.type === "delivery" ? DELIVERY_FEE : 0;

  // ── Promo (atomic consume, race-safe) ────────────────────────
  let discount_amount = 0;
  let promo_code_id: string | null = null;
  if (data.promo_code) {
    const { data: promo } = await supabaseAdmin
      .from("promo_codes")
      .select("*")
      .ilike("code", data.promo_code)
      .eq("is_active", true)
      .single();

    const valid =
      promo &&
      (!promo.expires_at || new Date(promo.expires_at) > new Date()) &&
      (promo.max_uses == null || promo.uses_count < promo.max_uses) &&
      subtotal >= Number(promo.min_order_amount);

    if (!valid) return { error: "Promo code is invalid or expired" };

    discount_amount =
      promo.discount_type === "percent"
        ? Math.round((subtotal * Number(promo.discount_value)) / 100)
        : Math.min(Number(promo.discount_value), subtotal);
    promo_code_id = promo.id;

    // Conditional increment — fails the guard if another request used the last slot
    const { data: bumped } = await supabaseAdmin
      .from("promo_codes")
      .update({ uses_count: promo.uses_count + 1 })
      .eq("id", promo.id)
      .eq("uses_count", promo.uses_count)
      .select("id");
    if (!bumped?.length) return { error: "Promo code just ran out — try again" };
  }

  // ── Rewards (signed-in customers): points as a discount, and the free item ──
  // Only the plan is made here; the balance is taken atomically just before the
  // order is written (loyalty_take), and given back if writing it fails.
  let points_redeemed = 0;
  let points_discount = 0;
  let free_item_redeemed = false;
  let rewardNote = "";
  if (isSelfCheckout && (data.use_points || data.use_free_item)) {
    const rewards = await getRewardSettings();
    const { data: bal } = await supabaseAdmin.from("loyalty_points").select("points, free_items").eq("customer_id", user.id).maybeSingle();
    if (!rewards.enabled) return { error: "Rewards are paused right now — please order without them" };
    if (data.use_free_item) {
      if (!rewards.free_item_enabled || !rewards.free_item_product_id) return { error: "The free item reward isn't available right now" };
      if ((bal?.free_items ?? 0) < 1) return { error: "You don't have a free item to claim yet" };
      const { data: fp } = await supabaseAdmin.from("products").select("id, name, is_available").eq("id", rewards.free_item_product_id).single();
      if (!fp?.is_available) return { error: `Your free ${fp?.name ?? "item"} is sold out right now — it'll wait for your next order` };
      itemRows.push({ product_id: fp.id, product_name: `${fp.name} (free reward)`, product_price: 0, quantity: 1, customization_notes: null, line_total: 0 });
      free_item_redeemed = true;
      rewardNote += `\nFree ${fp.name} (reward)`;
    }
    if (data.use_points) {
      const plan = redeemPlan(bal?.points ?? 0, subtotal + delivery_fee - discount_amount, rewards);
      if (!plan.points) return { error: `You need at least ${fmtPoints(rewards.min_redeem_points)} points to use them` };
      points_redeemed = plan.points;
      points_discount = plan.rupees;
      rewardNote += `\n${fmtPoints(plan.points)} points used (−${fmtRupees(plan.rupees)})`;
    }
  }

  const total = Math.max(0, subtotal + delivery_fee - discount_amount - points_discount);
  
  let finalNotes = data.notes ? data.notes.trim() : "";
  let extractedAddress = "";
  if (data.type === "delivery" && isSelfCheckout && data.delivery_address_id) {
    const { data: addr } = await supabaseAdmin.from("addresses").select("full_address").eq("id", data.delivery_address_id).single();
    if (addr) extractedAddress = addr.full_address;
  }

  if (isStaff) {
    finalNotes = `[POS Order]\nName: ${data.guest_name}\nPhone: ${data.guest_phone && data.guest_phone !== "N/A" ? data.guest_phone : "N/A"}${data.type === 'delivery' ? `\nAddress: ${data.guest_address}` : ""}\n\n${finalNotes}`.trim();
  } else if (isAnonymous) {
    finalNotes = `[Guest Checkout]\nName: ${data.guest_name}\nPhone: ${data.guest_phone}${data.type === 'delivery' ? `\nAddress: ${data.guest_address}` : ""}\n\n${finalNotes}`.trim();
  } else if (isSelfCheckout) {
    finalNotes = `[Registered User]\nName: ${profile.full_name}\nPhone: ${profile.phone ?? "N/A"}${data.type === 'delivery' && extractedAddress ? `\nAddress: ${extractedAddress}` : ""}${rewardNote ? `\n[Rewards]${rewardNote}` : ""}\n\n${finalNotes}`.trim();
  }

  if (isSelfCheckout && (points_redeemed > 0 || free_item_redeemed)) {
    const { data: took } = await supabaseAdmin.rpc("loyalty_take", { p_customer: user.id, p_points: points_redeemed, p_free: free_item_redeemed });
    if (!took) return { error: "Your rewards balance just changed — please check and try again" };
  }

  // ── Insert order + items ─────────────────────────────────────
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .insert({
      order_number: "pending", // replaced by trigger
      customer_id: isSelfCheckout ? user.id : null,
      placed_by: isStaff ? user.id : null,
      branch_id: isStaff ? await resolveStaffBranchId(profile.branch_id) : (data.branch_id ?? null),
      type: data.type,
      subtotal,
      delivery_fee,
      discount_amount,
      total,
      delivery_address_id: isSelfCheckout ? (data.delivery_address_id ?? null) : null,
      pickup_time: data.pickup_time ?? null,
      payment_method: data.payment_method,
      payment_status: "pending", // admin confirms cash/QR manually
      promo_code_id,
      notes: finalNotes || null,
      points_redeemed,
      points_discount,
      free_item_redeemed,
    })
    .select("id, order_number, total, daily_number")
    .single();

  if (orderErr || !order) {
    if (isSelfCheckout && (points_redeemed > 0 || free_item_redeemed)) {
      await supabaseAdmin.rpc("loyalty_give_back", { p_customer: user.id, p_points: points_redeemed, p_free: free_item_redeemed });
    }
    return { error: "Could not place the order. Try again." };
  }
  if (isSelfCheckout && (points_redeemed > 0 || free_item_redeemed)) {
    await supabaseAdmin.from("loyalty_transactions").insert([
      ...(points_redeemed > 0 ? [{ customer_id: user.id, order_id: order.id, points_change: -points_redeemed, reason: "redemption" }] : []),
      ...(free_item_redeemed ? [{ customer_id: user.id, order_id: order.id, points_change: 0, reason: "free_item_used" }] : []),
    ]);
  }

  await supabaseAdmin
    .from("order_items")
    .insert(itemRows.map((r) => ({ ...r, order_id: order.id })));

  // ── Delivery OTP — plaintext only goes to the customer's email ──
  let otpForEmail: string | null = null;
  if (data.type === "delivery") {
    otpForEmail = crypto.randomInt(1000, 10000).toString();
    await supabaseAdmin.from("deliveries").insert({
      order_id: order.id,
      delivery_otp_hash: hashOtp(otpForEmail, order.id),
    });
  }

  await audit({
    actor_id: user?.id ?? null,
    action: "CREATE_ORDER",
    target_table: "orders",
    target_id: order.id,
    new_data: { total, type: data.type, payment_method: data.payment_method },
  });

  // The confirmation email (signed-in customers only — never the staff member
  // placing a POS order). Sent after the response, so checkout never waits on it.
  if (isSelfCheckout && user.email) {
    const to = user.email;
    after(async () => {
      const rewards = await getRewardSettings();
      await sendEmail({
        to, from: FROM_ORDERS,
        ...orderConfirmedEmail({
          name: profile.full_name, orderId: order.id, orderNumber: order.order_number, dailyNumber: order.daily_number,
          type: data.type, paymentMethod: data.payment_method,
          items: itemRows.map((r) => ({ name: r.product_name, qty: r.quantity, lineTotal: r.line_total })),
          subtotal, deliveryFee: delivery_fee, promoDiscount: discount_amount, pointsDiscount: points_discount, pointsUsed: points_redeemed,
          total, pointsToEarn: rewards.enabled ? pointsForTotal(total, rewards) : 0, otp: otpForEmail,
        }),
      });
    });
  }

  // An online order: alert the POS devices (Web Push, with sound) — after the
  // customer already has their response, so a slow push service can't delay checkout.
  if (!isStaff) {
    const no = order.daily_number != null ? `#${String(order.daily_number).padStart(2, "0")}` : order.order_number;
    after(() => pushToStaff({
      title: `New online order ${no}`,
      body: `${data.type === "delivery" ? "Delivery" : "Pickup"} · ${itemRows.map((r) => `${r.quantity}× ${r.product_name}`).join(", ")} · ${npr(total)}`,
      tag: order.id,
      url: "/admin",
    }));
  }

  // Linked stock (Accounts → Stock) counts down with every sale; warn staff if it's running out.
  after(() => checkStockAfterSale(itemRows.map((r) => r.product_id)));

  return { orderId: order.id, orderNumber: order.order_number, dailyNumber: order.daily_number, total };
}

export async function validatePromoCode(code: string, subtotal: number) {
  if (!code) return { error: "Please enter a code" };
  
  const { data: promo } = await supabaseAdmin
    .from("promo_codes")
    .select("*")
    .ilike("code", code)
    .eq("is_active", true)
    .single();

  if (!promo) return { error: "Invalid promo code" };

  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { error: "This promo code has expired" };
  }

  if (promo.max_uses != null && promo.uses_count >= promo.max_uses) {
    return { error: "This promo code has reached its usage limit" };
  }

  if (subtotal < Number(promo.min_order_amount)) {
    return { error: `Minimum order of Nrs ${promo.min_order_amount} required` };
  }

  const discount = promo.discount_type === "percent"
    ? Math.round((subtotal * Number(promo.discount_value)) / 100)
    : Math.min(Number(promo.discount_value), subtotal);

  return { success: true, discount, type: promo.discount_type, value: promo.discount_value };
}
