"use server";

import { after } from "next/server";
import { z } from "zod";
import { getDaySales as loadDaySales } from "@/lib/day-sales";
import { posOrderSchema } from "@/lib/validations/order";
import { checkStockAfterSale, getPosStock as loadPosStock } from "@/lib/stock-alerts";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit, resolveStaffBranchId } from "@/lib/supabase/admin";
import { applyOpeningPromoPrice } from "@/lib/promo";
import { studentDiscount, memberUnitPrice, staffFreeItems, STUDENT_DISCOUNT_LABEL, MEMBER_PRICE_LABEL, STAFF_LABEL } from "@/lib/discounts";
import { getPosStaff, posLockOn } from "@/lib/pos-staff";

/** POS order: branch comes from the operator's OWN profile — never the client. */
export async function createPosOrder(input: unknown) {
  const { user, profile } = await requireRole(["pos_user", "super_admin"]);
  const parsed = posOrderSchema.safeParse(input);
  if (!parsed.success) {
    const memberIssue = parsed.error.issues.find((i) => i.path[0] === "members");
    return { error: memberIssue?.message ?? "Invalid order" };
  }
  const d = parsed.data;
  if ([d.member, d.student_discount, d.staff].filter(Boolean).length > 1) return { error: "Pick one deal — student, member or staff" };

  const branchId = await resolveStaffBranchId(profile.branch_id);
  if (!branchId && profile.role === "pos_user") {
    return { error: "Your account isn't linked to a branch — ask an admin" };
  }
  // Who's on the till (their PIN — migration 037). Once staff log in with PINs, the till won't sell without one.
  const seller = profile.role === "pos_user" ? await getPosStaff(user.id) : null;
  if (!seller && profile.role === "pos_user" && await posLockOn()) {
    return { error: "Nobody is logged in on this till — tap Refresh and type your PIN" };
  }

  const ids = d.items.map((i) => i.product_id);
  const [{ data: products }, { data: settings }] = await Promise.all([
    supabaseAdmin.from("products").select("id, name, price, is_available, student_discount_eligible, member_price, is_membership_card, categories(name)").in("id", ids),
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
  const staffLimit = Number(settings?.staff_free_items ?? 0);
  if (d.staff && staffLimit <= 0) return { error: "Staff sale is switched off — ask the manager" };

  let subtotal = 0;
  let discountable = 0;
  let memberSaving = 0;
  const rows = d.items.map((i) => {
    const p = products.find((x) => x.id === i.product_id)!;
    const effectivePrice = applyOpeningPromoPrice(Number(p.price), (p.categories as any)?.name, settings);
    const line = effectivePrice * i.quantity;
    subtotal += line;
    if (p.student_discount_eligible) discountable += line;
    memberSaving += (effectivePrice - memberUnitPrice(effectivePrice, p.member_price)) * i.quantity;
    return { product_id: p.id, product_name: p.name, product_price: effectivePrice, quantity: i.quantity, line_total: line, card: !!p.is_membership_card };
  });
  // Worked out here, never trusted from the screen — the toggles only ask for it.
  // Lines keep the normal price; the member/student/staff saving is the order's discount.
  const staff = d.staff ? staffFreeItems(rows.map((r) => ({ price: r.product_price, qty: r.quantity, eligible: !r.card })), staffLimit) : null;
  const discount = staff ? staff.saving
    : d.member ? Math.round(memberSaving * 100) / 100
    : d.student_discount ? studentDiscount(discountable) : 0;
  const discountLabel = !discount ? null : staff ? STAFF_LABEL : d.member ? MEMBER_PRICE_LABEL : STUDENT_DISCOUNT_LABEL;

  // Counter sales are anonymous walk-ins — the POS no longer asks for a name or phone.
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .insert({
      order_number: "pending",
      customer_id: null,
      placed_by: user.id,
      staff_person_id: seller?.id ?? null,
      staff_name: seller?.name ?? null,
      branch_id: branchId,
      type: d.type,
      status: "confirmed",
      subtotal,
      delivery_fee: 0,
      discount_amount: discount,
      discount_label: discountLabel,
      total: subtotal - discount,
      payment_method: d.payment_method,
      payment_status: "paid", // POS = paid at counter
      notes: null,
    })
    .select("id, order_number, daily_number, total")
    .single();
  if (error || !order) return { error: "Order failed" };

  await supabaseAdmin.from("order_items").insert(rows.map(({ card: _card, ...r }) => ({ ...r, order_id: order.id })));
  // Card numbers come from the database (003, 004, … — migration 030). A clash
  // with a number the admin typed by hand just takes the next one.
  let savedMembers: { full_name: string; phone: string; card_number: string | null }[] = [];
  if (members.length) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error: memberErr } = await supabaseAdmin.from("memberships")
        .insert(members.map((m) => ({ full_name: m.full_name, phone: m.phone, order_id: order.id, sold_by: user.id })))
        .select("full_name, phone, card_number");
      if (!memberErr) { savedMembers = data ?? []; break; }
      if (memberErr.code !== "23505" || attempt === 3) { console.error("Couldn't save membership details:", memberErr.message); break; }
    }
  }
  await audit({
    actor_id: user.id, action: "POS_ORDER", target_table: "orders", target_id: order.id,
    new_data: { total: order.total, ...(seller ? { sold_by: seller.name } : {}), ...(discount ? { discount, discount_label: discountLabel } : {}), ...(staff?.used ? { staff_free_items: staff.used } : {}), ...(members.length ? { memberships: members.length } : {}) },
  });
  // Linked stock (Accounts → Stock) counts down with every sale; warn staff if it's running out.
  after(() => checkStockAfterSale(rows.map((r) => r.product_id)));
  return {
    ok: true, orderNumber: order.order_number, dailyNumber: order.daily_number, total: order.total, discount, discountLabel,
    members: savedMembers.map((m) => ({ name: m.full_name, phone: m.phone, card: m.card_number })),
  };
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
