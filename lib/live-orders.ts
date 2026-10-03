// The POS Live Orders list — one query for both the page load and the panel's
// periodic re-sync, so the two can never disagree about an order's shape.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function fetchLiveOrders() {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, daily_number, status, type, total, discount_label, payment_status, payment_method, created_at, notes, delivery_address, delivery_lat, delivery_lng, customer:profiles!customer_id(full_name, phone), items:order_items(product_name, quantity)")
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
