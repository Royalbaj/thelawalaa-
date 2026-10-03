// Guest + customer order tracking. The order id (an unguessable UUID) is
// the intended capability — deliberately not gated by auth. That model
// only actually holds when the lookup can ONLY ever be by exact id, which
// an RLS policy can't express (a policy that lets you read a row lets you
// list it too). So this fetches via the service role after validating the
// id shape, and only ever queries by exact id — never a list.
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deliveryOtp } from "@/lib/delivery-otp";

export const dynamic = "force-dynamic";

const DONE = ["delivered", "cancelled"];

export async function GET(_req: Request, props: { params: Promise<{ orderId: string }> }) {
  const params = await props.params;
  if (!z.string().uuid().safeParse(params.orderId).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, daily_number, status, type, total, payment_status, payment_method, created_at, customer_id, delivery_address")
    .eq("id", params.orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("product_name, quantity, line_total")
    .eq("order_id", params.orderId);

  // Prices only while the order is open — a finished order shows what was
  // in it, not what it cost.
  const done = DONE.includes(order.status);
  // The delivery code: only to the signed-in customer who owns the order
  // (a guest saw it when they placed it). Riders know the order id, so the
  // id alone must never reveal it.
  let deliveryCode: string | null = null;
  if (order.type === "delivery" && !done && order.customer_id) {
    const { data: { user } } = await (await createClient()).auth.getUser();
    if (user?.id === order.customer_id) deliveryCode = deliveryOtp(order.id);
  }

  const { customer_id: _owner, total, ...rest } = order;
  return NextResponse.json({
    order: { ...rest, total: done ? null : total },
    items: (items ?? []).map((i) => ({ product_name: i.product_name, quantity: i.quantity, line_total: done ? null : i.line_total })),
    deliveryCode,
  }, { headers: { "Cache-Control": "no-store" } });
}
