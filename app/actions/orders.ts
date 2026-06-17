"use server";

import crypto from "crypto";
import { Resend } from "resend";
import { orderSchema } from "@/lib/validations/order";
import { getVerifiedUser } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function hashOtp(otp: string, orderId: string) {
  return crypto
    .createHmac("sha256", process.env.OTP_HMAC_SECRET!)
    .update(`${orderId}:${otp}`)
    .digest("hex");
}

// USP: flat Nrs 20 home delivery within 5km of the store (Manigram at launch).
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

  const { user, profile } = await getVerifiedUser();
  if (!user || !profile || !["customer", "admin"].includes(profile.role)) {
    return { error: "Please log in to order" };
  }

  // ── Re-price everything server-side ──────────────────────────
  const ids = data.items.map((i) => i.product_id);
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name, price, is_available")
    .in("id", ids);

  if (!products || products.length !== new Set(ids).size) {
    return { error: "Some items are no longer on the menu" };
  }
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const item of data.items) {
    const p = byId.get(item.product_id);
    if (!p || !p.is_available) return { error: `"${p?.name ?? "An item"}" is sold out` };
  }

  let subtotal = 0;
  const itemRows = data.items.map((i) => {
    const p = byId.get(i.product_id)!;
    const line = Number(p.price) * i.quantity;
    subtotal += line;
    return {
      product_id: p.id,
      product_name: p.name,
      product_price: p.price,
      quantity: i.quantity,
      customization_notes: i.customization_notes ?? null,
      line_total: line,
    };
  });

  // Verify the delivery address belongs to THIS customer
  if (data.type === "delivery") {
    const { data: addr } = await supabaseAdmin
      .from("addresses")
      .select("id, customer_id")
      .eq("id", data.delivery_address_id!)
      .single();
    if (!addr || addr.customer_id !== user.id) return { error: "Invalid delivery address" };
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

  const total = Math.max(0, subtotal + delivery_fee - discount_amount);

  // ── Insert order + items ─────────────────────────────────────
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .insert({
      order_number: "pending", // replaced by trigger
      customer_id: user.id,
      branch_id: data.branch_id ?? null,
      type: data.type,
      subtotal,
      delivery_fee,
      discount_amount,
      total,
      delivery_address_id: data.delivery_address_id ?? null,
      pickup_time: data.pickup_time ?? null,
      payment_method: data.payment_method,
      payment_status: "pending", // admin confirms cash/QR manually
      promo_code_id,
      notes: data.notes ?? null,
    })
    .select("id, order_number, total")
    .single();

  if (orderErr || !order) return { error: "Could not place the order. Try again." };

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
    actor_id: user.id,
    action: "CREATE_ORDER",
    target_table: "orders",
    target_id: order.id,
    new_data: { total, type: data.type, payment_method: data.payment_method },
  });

  if (resend && user.email) {
    try {
      await resend.emails.send({
        from: "Thelawalaa <orders@thelawalaa.com>",
        to: user.email,
        subject: `Order confirmed — ${order.order_number}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:auto">
            <h1 style="color:#F97316">Order confirmed! 🎉</h1>
            <p>Your order <b>${order.order_number}</b> for <b>Rs ${order.total}</b> is in.</p>
            <p>${data.payment_method === "qr"
              ? "Pay by scanning our QR code when you receive your order — our team will confirm it."
              : "Please keep <b>Rs " + order.total + "</b> in cash ready — our team will confirm the payment."}</p>
            ${otpForEmail ? `<p style="font-size:24px;letter-spacing:6px;background:#FFFBEB;padding:16px;border-radius:12px;text-align:center"><b>${otpForEmail}</b></p><p>Share this OTP with your delivery driver to confirm delivery.</p>` : ""}
            <a href="${process.env.NEXT_PUBLIC_SITE_URL}/track/${order.id}"
               style="display:inline-block;background:#F97316;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold">Track your order</a>
          </div>`,
      });
    } catch { /* email failure must not fail the order */ }
  }

  return { orderId: order.id, orderNumber: order.order_number, total };
}
