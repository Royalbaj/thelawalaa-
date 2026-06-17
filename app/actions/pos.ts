"use server";

import { posOrderSchema } from "@/lib/validations/order";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";

/** POS order: branch comes from the operator's OWN profile — never the client. */
export async function createPosOrder(input: unknown) {
  const { user, profile } = await requireRole(["pos_user", "admin"]);
  const parsed = posOrderSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid order" };
  const d = parsed.data;

  if (!profile.branch_id && profile.role === "pos_user") {
    return { error: "Your account isn't linked to a branch — ask an admin" };
  }

  const ids = d.items.map((i) => i.product_id);
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, name, price, is_available")
    .in("id", ids);
  if (!products || products.length !== new Set(ids).size) return { error: "Unknown items in cart" };

  let subtotal = 0;
  const rows = d.items.map((i) => {
    const p = products.find((x) => x.id === i.product_id)!;
    if (!p.is_available) throw new Error("sold out");
    const line = Number(p.price) * i.quantity;
    subtotal += line;
    return { product_id: p.id, product_name: p.name, product_price: p.price, quantity: i.quantity, line_total: line };
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
    })
    .select("id, order_number, total")
    .single();
  if (error || !order) return { error: "Order failed" };

  await supabaseAdmin.from("order_items").insert(rows.map((r) => ({ ...r, order_id: order.id })));
  await audit({ actor_id: user.id, action: "POS_ORDER", target_table: "orders", target_id: order.id, new_data: { total: order.total } });
  return { ok: true, orderNumber: order.order_number, total: order.total };
}
