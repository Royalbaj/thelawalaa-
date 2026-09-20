// Guest + customer order tracking. The order id (an unguessable UUID) is
// the intended capability — deliberately not gated by auth. That model
// only actually holds when the lookup can ONLY ever be by exact id, which
// an RLS policy can't express (a policy that lets you read a row lets you
// list it too). So this fetches via the service role after validating the
// id shape, and only ever queries by exact id — never a list.
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { orderId: string } }) {
  if (!z.string().uuid().safeParse(params.orderId).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, daily_number, status, type, total, payment_status, payment_method, created_at")
    .eq("id", params.orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("product_name, quantity, line_total")
    .eq("order_id", params.orderId);

  return NextResponse.json({ order, items: items ?? [] });
}
