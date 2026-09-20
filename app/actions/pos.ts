"use server";

import { posOrderSchema } from "@/lib/validations/order";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit, awardOrderLoyaltyPoints } from "@/lib/supabase/admin";
import { applyOpeningPromoPrice } from "@/lib/promo";

/** POS order: branch comes from the operator's OWN profile — never the client. */
export async function createPosOrder(input: unknown) {
  const { user, profile } = await requireRole(["pos_user", "admin", "super_admin"]);
  const parsed = posOrderSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid order" };
  const d = parsed.data;

  if (!profile.branch_id && profile.role === "pos_user") {
    return { error: "Your account isn't linked to a branch — ask an admin" };
  }

  const ids = d.items.map((i) => i.product_id);
  const [{ data: products }, { data: settings }] = await Promise.all([
    supabaseAdmin.from("products").select("id, name, price, is_available, categories(name)").in("id", ids),
    supabaseAdmin.from("app_settings").select("*").eq("id", 1).single(),
  ]);
  if (!products || products.length !== new Set(ids).size) return { error: "Unknown items in cart" };

  let subtotal = 0;
  const rows = d.items.map((i) => {
    const p = products.find((x) => x.id === i.product_id)!;
    if (!p.is_available) throw new Error("sold out");
    const effectivePrice = applyOpeningPromoPrice(Number(p.price), (p.categories as any)?.name, settings);
    const line = effectivePrice * i.quantity;
    subtotal += line;
    return { product_id: p.id, product_name: p.name, product_price: effectivePrice, quantity: i.quantity, line_total: line };
  });

  // Optional: attach walk-in customer by phone
  let customer_id: string | null = null;
  if (d.customer_phone) {
    const { data: c } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", d.customer_phone.replace(/^\+977/, ""))
      .eq("role", "customer")
      .maybeSingle();
    customer_id = c?.id ?? null;
  }

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .insert({
      order_number: "pending",
      customer_id,
      placed_by: user.id,
      branch_id: profile.branch_id,
      type: d.type,
      status: "confirmed",
      subtotal,
      delivery_fee: 0,
      discount_amount: 0,
      total: subtotal,
      payment_method: d.payment_method,
      payment_status: "paid", // POS = paid at counter
      notes: d.customer_name ? `[POS Order]\nName: ${d.customer_name}\nPhone: ${d.customer_phone || "N/A"}` : null,
    })
    .select("id, order_number, daily_number, total")
    .single();
  if (error || !order) return { error: "Order failed" };

  await supabaseAdmin.from("order_items").insert(rows.map((r) => ({ ...r, order_id: order.id })));
  await awardOrderLoyaltyPoints(customer_id, Number(order.total));
  await audit({ actor_id: user.id, action: "POS_ORDER", target_table: "orders", target_id: order.id, new_data: { total: order.total } });
  return { ok: true, orderNumber: order.order_number, dailyNumber: order.daily_number, total: order.total };
}
