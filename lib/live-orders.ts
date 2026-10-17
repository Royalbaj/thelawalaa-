// The POS Live Orders list — one query for both the page load and the panel's
// periodic re-sync, so the two can never disagree about an order's shape.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

const NPT_OFFSET_MS = (5 * 60 + 45) * 60_000;
const DAY_MS = 86_400_000;
/** Midnight at the start of today in Banepa, as an ISO instant. */
const nepalTodayStart = () => new Date(Math.floor((Date.now() + NPT_OFFSET_MS) / DAY_MS) * DAY_MS - NPT_OFFSET_MS).toISOString();

/** Every order taken today (the panel's "Today" list), plus anything older that's still open. */
export async function fetchLiveOrders() {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, daily_number, status, type, total, discount_label, payment_status, payment_method, placed_by, scheduled_for, scheduled_until, created_at, served_at, notes, delivery_address, delivery_lat, delivery_lng, customer:profiles!customer_id(full_name, phone), items:order_items(product_name, quantity)")
    .or(`created_at.gte.${nepalTodayStart()},status.not.in.(delivered,cancelled)`)
    .order("created_at", { ascending: false })
    .limit(400);
  return data ?? [];
}
