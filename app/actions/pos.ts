"use server";

import { posOrderSchema } from "@/lib/validations/order";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit, resolveStaffBranchId } from "@/lib/supabase/admin";
import { applyOpeningPromoPrice } from "@/lib/promo";
import { studentDiscount, memberUnitPrice, STUDENT_DISCOUNT_LABEL, MEMBER_PRICE_LABEL } from "@/lib/discounts";

/** POS order: branch comes from the operator's OWN profile — never the client. */
export async function createPosOrder(input: unknown) {
  const { user, profile } = await requireRole(["pos_user", "super_admin"]);
  const parsed = posOrderSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid order" };
  const d = parsed.data;
  if (d.member && d.student_discount) return { error: "Use member price or student discount — not both" };

  const branchId = await resolveStaffBranchId(profile.branch_id);
  if (!branchId && profile.role === "pos_user") {
    return { error: "Your account isn't linked to a branch — ask an admin" };
  }

  const ids = d.items.map((i) => i.product_id);
  const [{ data: products }, { data: settings }] = await Promise.all([
    supabaseAdmin.from("products").select("id, name, price, is_available, student_discount_eligible, member_price, categories(name)").in("id", ids),
    supabaseAdmin.from("app_settings").select("*").eq("id", 1).single(),
  ]);
  if (!products || products.length !== new Set(ids).size) return { error: "Unknown items in cart" };
  const soldOut = products.find((p) => !p.is_available);
  if (soldOut) return { error: `"${soldOut.name}" is sold out` };

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
    return { product_id: p.id, product_name: p.name, product_price: effectivePrice, quantity: i.quantity, line_total: line };
  });
  // Worked out here, never trusted from the screen — the toggles only ask for it.
  // Lines keep the normal price; the member/student saving is the order's discount.
  const discount = d.member ? Math.round(memberSaving * 100) / 100 : d.student_discount ? studentDiscount(discountable) : 0;
  const discountLabel = !discount ? null : d.member ? MEMBER_PRICE_LABEL : STUDENT_DISCOUNT_LABEL;

  // Counter sales are anonymous walk-ins — the POS no longer asks for a name or phone.
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .insert({
      order_number: "pending",
      customer_id: null,
      placed_by: user.id,
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

  await supabaseAdmin.from("order_items").insert(rows.map((r) => ({ ...r, order_id: order.id })));
  await audit({
    actor_id: user.id, action: "POS_ORDER", target_table: "orders", target_id: order.id,
    new_data: { total: order.total, ...(discount ? { discount, discount_label: discountLabel } : {}) },
  });
  return { ok: true, orderNumber: order.order_number, dailyNumber: order.daily_number, total: order.total, discount, discountLabel };
}
