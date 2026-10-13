"use server";

import { after } from "next/server";
import { z } from "zod";
import { getDaySales as loadDaySales } from "@/lib/day-sales";
import { posOrderSchema } from "@/lib/validations/order";
import { checkStockAfterSale, getPosStock as loadPosStock } from "@/lib/stock-alerts";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit, resolveStaffBranchId } from "@/lib/supabase/admin";
import { applyOpeningPromoPrice } from "@/lib/promo";
import { studentDiscount, memberUnitPrice, staffFreeItems, managerFreeItems, halfPlatePrice, halfPlateName, STUDENT_DISCOUNT_LABEL, MEMBER_PRICE_LABEL, STAFF_LABEL, MANAGER_LABEL } from "@/lib/discounts";
import { getPosStaff, posLockOn, posLoginKey } from "@/lib/pos-staff";
import { managerForPin } from "@/lib/manager-pin";
import { memberForCard } from "@/lib/member-card";
import { findCode, codeProblem, codeAmount, useCode } from "@/lib/promo-codes";
import { deliveryFeeFor } from "@/lib/delivery-fee";
import { deliveryOtp, hashOtp } from "@/lib/delivery-otp";

/** POS order: branch comes from the operator's OWN profile — never the client. */
export async function createPosOrder(input: unknown) {
  const { user, profile } = await requireRole(["pos_user", "super_admin"]);
  const parsed = posOrderSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => i.path[0] === "members" || i.path[0] === "delivery");
    return { error: issue?.message ?? "Invalid order" };
  }
  const d = parsed.data;
  if ([d.member, d.student_discount, d.staff, d.manager, d.promo_code].filter(Boolean).length > 1) return { error: "Pick one deal — student, member, code, staff or manager" };

  const branchId = await resolveStaffBranchId(profile.branch_id);
  if (!branchId && profile.role === "pos_user") {
    return { error: "Your account isn't linked to a branch — ask an admin" };
  }
  // Who's on the till (their PIN — migration 037). Once staff log in with PINs, the till won't sell without one.
  const seller = profile.role === "pos_user" ? await getPosStaff(posLoginKey(user)) : null;
  if (!seller && profile.role === "pos_user" && await posLockOn()) {
    return { error: "Nobody is logged in on this till — tap Refresh and type your PIN" };
  }

  const ids = d.items.map((i) => i.product_id);
  const [{ data: products }, { data: settings }] = await Promise.all([
    supabaseAdmin.from("products").select("id, name, price, half_price, is_available, student_discount_eligible, member_price, is_membership_card, is_frozen, categories(name)").in("id", ids),
    supabaseAdmin.from("app_settings").select("*").eq("id", 1).single(),
  ]);
  if (!products || products.length !== new Set(ids).size) return { error: "Unknown items in cart" };
  const soldOut = products.find((p) => !p.is_available);
  if (soldOut) return { error: `"${soldOut.name}" is sold out` };
  // Every membership card sold needs the new member's name and number.
  const cards = d.items.reduce((n, i) => n + (products.find((p) => p.id === i.product_id)?.is_membership_card ? i.quantity : 0), 0);
  const members = d.members ?? [];
  if (cards > 10) return { error: "Sell up to 10 membership cards at a time" };
  if (members.length !== cards) {
    return { error: cards ? `Add the member's name and mobile number${cards > 1 ? ` for all ${cards} cards` : ""}` : "Member details without a membership card" };
  }
  // Card numbers (migration 044): the next automatic one (101–200) unless one was typed;
  // after 200 the number written on the card must be typed. Checked before the sale is saved.
  if (members.length) {
    const typed = members.map((m) => m.card_number).filter((c): c is string => !!c);
    if (new Set(typed).size !== typed.length) return { error: "Two new members have the same card number" };
    if (typed.length) {
      const { data: taken } = await supabaseAdmin.from("memberships").select("card_number, full_name").in("card_number", typed);
      if (taken?.length) return { error: `Card ${taken[0].card_number} is already ${taken[0].full_name}'s — check the number on the card` };
    }
    if (typed.length < members.length) {
      const { data: next } = await supabaseAdmin.rpc("peek_membership_card");
      if (next == null) return { error: "Automatic card numbers (101–200) are all used — type the number written on each card" };
    }
  }
  // Delivery from the counter (phone orders, migration 045): the manager's switch, and who/where.
  if (d.type === "delivery") {
    if (settings?.pos_delivery_enabled === false) return { error: "Delivery from the POS is switched off — ask the manager" };
    if (!d.delivery) return { error: "Add the customer's name, mobile number and address" };
  }
  const staffLimit = Number(settings?.staff_free_items ?? 0);
  if (d.staff && staffLimit <= 0) return { error: "Staff sale is switched off — ask the manager" };
  // Manager discount: the manager's own PIN, checked again here (migration 038).
  let approver: { id: string; name: string } | null = null;
  if (d.manager) {
    const m = await managerForPin(d.manager_pin, user.id);
    if ("error" in m) return { error: `Manager discount: ${m.error}` };
    approver = m.manager;
  }
  // Member price: the member's own card (its last 3 digits), checked again here (migration 041).
  let member: { id: string; name: string; card: string } | null = null;
  if (d.member) {
    const m = await memberForCard(d.member_card);
    if ("error" in m) return { error: `Member price: ${m.error}` };
    member = m.member;
  }

  let subtotal = 0;
  let discountable = 0;
  let memberSaving = 0;
  // The order lines, in the same order the screen builds them: each item's whole
  // plates, then its extra half plate (if any) as a line of its own.
  const rows: { product_id: string; product_name: string; product_price: number; quantity: number; line_total: number; portion: number; card: boolean; frozen: boolean }[] = [];
  for (const i of d.items) {
    const p = products.find((x) => x.id === i.product_id)!;
    const effectivePrice = applyOpeningPromoPrice(Number(p.price), (p.categories as any)?.name, settings);
    const half = i.half ? halfPlatePrice(p.half_price, effectivePrice) : null;
    if (i.half && (half == null || p.is_membership_card)) return { error: `"${p.name}" isn't sold as a half plate` };
    const line = effectivePrice * i.quantity;
    subtotal += line + (half ?? 0);
    if (p.student_discount_eligible) discountable += line + (half ?? 0);
    // Member price is for whole plates only — never the extra half.
    memberSaving += (effectivePrice - memberUnitPrice(effectivePrice, p.member_price)) * i.quantity;
    rows.push({ product_id: p.id, product_name: p.name, product_price: effectivePrice, quantity: i.quantity, line_total: line, portion: 1, card: !!p.is_membership_card, frozen: !!p.is_frozen });
    if (half != null) {
      rows.push({ product_id: p.id, product_name: halfPlateName(p.name), product_price: half, quantity: 1, line_total: half, portion: 0.5, card: false, frozen: !!p.is_frozen });
    }
  }
  // Worked out here, never trusted from the screen — the toggles only ask for it.
  // Lines keep the normal price; the member/student/staff/manager saving is the order's discount.
  // "Code" deal: a discount code from Admin → Settings → Discount codes, checked again here.
  const promo = d.promo_code ? await findCode(d.promo_code) : null;
  if (d.promo_code) {
    const problem = codeProblem(promo, subtotal);
    if (problem) return { error: `Code: ${problem}` };
  }
  const staff = d.staff ? staffFreeItems(rows.map((r) => ({ price: r.product_price, qty: r.quantity, eligible: !r.card })), staffLimit) : null;
  const manager = approver ? managerFreeItems(rows.map((r) => ({ price: r.product_price, qty: r.quantity, eligible: !r.card && !r.frozen }))) : null;
  const discount = manager ? manager.saving
    : staff ? staff.saving
    : d.member ? Math.round(memberSaving * 100) / 100
    : promo ? codeAmount(promo, subtotal)
    : d.student_discount ? studentDiscount(discountable) : 0;
  const discountLabel = !discount ? null : manager ? MANAGER_LABEL : staff ? STAFF_LABEL : d.member ? MEMBER_PRICE_LABEL
    : promo ? `Code ${promo.code}` : STUDENT_DISCOUNT_LABEL;
  // Count the code's use before the sale is saved — conditional, so the last use can't go twice.
  if (promo && !(await useCode(promo))) return { error: "Code: that code just ran out — try again" };

  // Counter sales are anonymous walk-ins — the POS asks for a name and phone only for a delivery.
  // A delivery pays on arrival (the rider collects), with the same charge as online:
  // Rs 20 under Rs 99 of food (lib/delivery-fee.ts). The notes header is the one createOrder
  // writes, which the rider screens read the name / phone / address from (lib/order-notes.ts).
  const isDelivery = d.type === "delivery" && !!d.delivery;
  const delivery_fee = isDelivery ? deliveryFeeFor(subtotal, settings) : 0;
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .insert({
      order_number: "pending",
      customer_id: null,
      placed_by: user.id,
      staff_person_id: seller?.id ?? null,
      staff_name: seller?.name ?? null,
      discount_approved_by: manager && discount ? approver!.name : null,
      membership_id: member?.id ?? null,
      promo_code_id: promo?.id ?? null,
      member_card: member?.card ?? null,
      branch_id: branchId,
      type: d.type,
      status: "confirmed",
      subtotal,
      delivery_fee,
      discount_amount: discount,
      discount_label: discountLabel,
      total: subtotal - discount + delivery_fee,
      payment_method: d.payment_method,
      payment_status: isDelivery ? "pending" : "paid", // POS = paid at the counter; a delivery is paid to the rider
      delivery_address: isDelivery ? d.delivery!.address : null,
      notes: isDelivery
        ? `[POS Order]\nName: ${d.delivery!.name}\nPhone: ${d.delivery!.phone}\nAddress: ${d.delivery!.address.replace(/\s*\n\s*/g, ", ")}`
        : null,
    })
    .select("id, order_number, daily_number, total")
    .single();
  if (error || !order) return { error: "Order failed" };

  await supabaseAdmin.from("order_items").insert(rows.map(({ card: _card, frozen: _frozen, ...r }) => ({ ...r, order_id: order.id })));
  // The delivery code the rider asks for — only its hash is stored. The POS shows it so the
  // counter can tell the customer (on the phone, for a phone order).
  let deliveryCode: string | null = null;
  if (isDelivery) {
    deliveryCode = deliveryOtp(order.id);
    await supabaseAdmin.from("deliveries").insert({ order_id: order.id, delivery_otp_hash: hashOtp(deliveryCode, order.id) });
  }
  // Automatic card numbers come from the database (101–200 — migration 044); a typed
  // one is used as it is. A clash with a number the admin typed by hand takes the next one.
  let savedMembers: { full_name: string; phone: string; card_number: string | null }[] = [];
  if (members.length) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error: memberErr } = await supabaseAdmin.from("memberships")
        .insert(members.map((m) => ({ full_name: m.full_name, phone: m.phone, order_id: order.id, sold_by: user.id, ...(m.card_number ? { card_number: m.card_number } : {}) })))
        .select("full_name, phone, card_number");
      if (!memberErr) { savedMembers = data ?? []; break; }
      if (memberErr.code !== "23505" || attempt === 3) { console.error("Couldn't save membership details:", memberErr.message); break; }
    }
  }
  await audit({
    actor_id: user.id, action: "POS_ORDER", target_table: "orders", target_id: order.id,
    new_data: { total: order.total, ...(seller ? { sold_by: seller.name } : {}), ...(discount ? { discount, discount_label: discountLabel } : {}), ...(staff?.used ? { staff_free_items: staff.used } : {}), ...(manager?.used ? { manager_free_items: manager.used, approved_by: approver!.name } : {}), ...(member ? { member_card: member.card } : {}), ...(members.length ? { memberships: members.length } : {}) },
  });
  // Linked stock (Accounts → Stock) counts down with every sale; warn staff if it's running out.
  after(() => checkStockAfterSale(rows.map((r) => r.product_id)));
  return {
    ok: true, orderNumber: order.order_number, dailyNumber: order.daily_number, total: order.total, discount, discountLabel,
    deliveryCode, deliveryFee: delivery_fee,
    member: member ? { name: member.name, card: member.card } : null,
    // The next automatic card number, for the POS's "give card no. …" (null once 101–200 are used).
    nextCard: members.length ? ((await supabaseAdmin.rpc("peek_membership_card")).data as number | null) : undefined,
    members: savedMembers.map((m) => ({ name: m.full_name, phone: m.phone, card: m.card_number })),
  };
}

/** POS "Code" deal: is this discount code live? The minimum order is shown on the screen; the order checks everything again. */
export async function checkPosCode(code: unknown) {
  await requireRole(["pos_user", "super_admin"]);
  const c = z.string().trim().min(1).max(30).safeParse(code);
  if (!c.success) return { error: "Type the code" };
  const promo = await findCode(c.data);
  const problem = codeProblem(promo, Number.MAX_SAFE_INTEGER);
  if (problem || !promo) return { error: problem ?? "That code isn't valid" };
  return { ok: true as const, code: promo.code, type: promo.discount_type, value: Number(promo.discount_value), min: Number(promo.min_order_amount) };
}

/** POS "Member" deal: whose card is this (its last 3 digits)? The order checks it again when it's placed. */
export async function checkMemberCard(digits: unknown) {
  await requireRole(["pos_user", "super_admin"]);
  const m = await memberForCard(digits);
  if ("error" in m) return m;
  return { ok: true as const, name: m.member.name, card: m.member.card };
}

/** POS "Manager" deal: is this a manager's PIN? The order checks it again when it's placed. */
export async function checkManagerPin(pin: unknown) {
  const { user } = await requireRole(["pos_user", "super_admin"]);
  const m = await managerForPin(pin, user.id);
  if ("error" in m) return m;
  return { ok: true as const, name: m.manager.name };
}

/** Stock that's running low or out, for the POS warnings (re-checked every minute and after each sale). */
export async function getPosStock() {
  await requireRole(["pos_user", "super_admin"]);
  return loadPosStock();
}

// ── End of shift: today's sales and the cash count ───────────────

/** The POS "Today" sheet — the whole Nepal day, or since the last shift close. */
export async function getDaySales(period: "day" | "shift" = "day") {
  await requireRole(["pos_user", "super_admin"]);
  return loadDaySales(period === "shift" ? "shift" : "day");
}

const closeSchema = z.object({
  period: z.enum(["day", "shift"]),
  opening_float: z.number().min(0).max(1_000_000),
  counted_cash: z.number().min(0).max(10_000_000), // one total — the counter isn't asked note by note
  counted_by: z.string().trim().max(40).optional(),
  note: z.string().trim().max(300).optional(),
});

/**
 * "Close shift": saves the count against what the drawer SHOULD hold — the
 * expected figure is worked out again here, never taken from the screen.
 * Kept in audit_logs (SHIFT_CLOSE); the next shift starts from this moment.
 */
export async function closeShift(input: unknown) {
  const { user } = await requireRole(["pos_user", "super_admin"]);
  const parsed = closeSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the cash count" };
  const d = parsed.data;
  const counted = Math.round(d.counted_cash * 100) / 100;
  const day = await loadDaySales(d.period);
  const expected = Math.round((d.opening_float + day.cashReceived) * 100) / 100;
  const difference = Math.round((counted - expected) * 100) / 100;
  await audit({
    actor_id: user.id, action: "SHIFT_CLOSE", target_table: "orders",
    new_data: {
      from: day.from, period: d.period, opening_float: d.opening_float, cash_received: day.cashReceived,
      expected_cash: expected, counted_cash: counted, difference,
      sales: day.sales, orders: day.orders, by_method: day.byMethod, to_collect: day.toCollect.amount,
      counted_by: d.counted_by || null, note: d.note || null, problems: day.problems.reduce((n, p) => n + p.orders.length, 0),
    },
  });
  return { ok: true, expected, counted, difference };
}
