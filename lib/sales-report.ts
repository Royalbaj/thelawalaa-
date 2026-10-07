import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { addDays, dayCount, eachDay, eachMonth, monthLabel, shortDate, startOfMonth, type Ymd } from "@/lib/dates";
import { servingStats } from "@/lib/serving-time";

// Admin → Reports: what the orders say (POS + website), by Nepal date.
// "Sales" = paid, not-cancelled orders; unpaid ones show as "to collect".

const NPT_MS = (5 * 60 + 45) * 60_000;
const npt = (iso: string) => new Date(new Date(iso).getTime() + NPT_MS);
export const nepalDay = (iso: string): Ymd => npt(iso).toISOString().slice(0, 10);
export const nepalTime = (iso: string) => npt(iso).toISOString().slice(11, 16);
const startOf = (d: Ymd) => `${d}T00:00:00+05:45`;

export type ReportOrder = {
  id: string; order_number: string; daily_number: number | null; created_at: string; status: string; type: string;
  subtotal: number; discount_amount: number; discount_label: string | null; delivery_fee: number; total: number;
  payment_method: string | null; payment_status: string; placed_by: string | null;
  staff_name: string | null;                  // who sold it at the POS (PIN login, migration 037)
  discount_approved_by: string | null;        // the manager who approved a manager discount (migration 038)
  ready_at: string | null; served_at: string | null;
};
export type ReportItem = { order_id: string; product_id: string | null; product_name: string; quantity: number; line_total: number };

export const TYPE_LABELS: Record<string, string> = { dine_in: "Dine-in", pickup: "Pickup", delivery: "Delivery" };
export const METHOD_LABELS: Record<string, string> = { cash: "Cash", qr: "QR", esewa: "eSewa", card: "Card", other: "Other" };
export const channelOf = (o: ReportOrder) => (o.placed_by ? "Counter (POS)" : "Online");

async function fetchOrders(from: Ymd, to: Ymd) {
  const out: ReportOrder[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin.from("orders")
      .select("id, order_number, daily_number, created_at, status, type, subtotal, discount_amount, discount_label, delivery_fee, total, payment_method, payment_status, placed_by, staff_name, discount_approved_by, ready_at, served_at")
      .gte("created_at", startOf(from)).lt("created_at", startOf(addDays(to, 1)))
      .order("created_at").range(offset, offset + 999);
    if (error) throw new Error(`Couldn't load orders: ${error.message}`);
    out.push(...(data ?? []).map((o) => ({
      ...o, subtotal: Number(o.subtotal), discount_amount: Number(o.discount_amount ?? 0),
      delivery_fee: Number(o.delivery_fee ?? 0), total: Number(o.total),
    })) as ReportOrder[]);
    if (!data || data.length < 1000) return out;
  }
}

async function fetchItems(orderIds: string[]) {
  const out: ReportItem[] = [];
  for (let i = 0; i < orderIds.length; i += 200) {
    const { data } = await supabaseAdmin.from("order_items")
      .select("order_id, product_id, product_name, quantity, line_total").in("order_id", orderIds.slice(i, i + 200));
    out.push(...(data ?? []).map((r) => ({ ...r, quantity: Number(r.quantity), line_total: Number(r.line_total) })) as ReportItem[]);
  }
  return out;
}

export type Slice = { id: string; name: string; amount: number; share: number; count?: number };
const slices = (m: Map<string, { amount: number; count: number }>, label = (k: string) => k): Slice[] => {
  const total = [...m.values()].reduce((s, v) => s + v.amount, 0);
  return [...m.entries()].map(([k, v]) => ({ id: k, name: label(k), amount: v.amount, count: v.count, share: total ? v.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
};
const bump = (m: Map<string, { amount: number; count: number }>, k: string, amount: number, count = 1) => {
  const cur = m.get(k) ?? { amount: 0, count: 0 };
  m.set(k, { amount: cur.amount + amount, count: cur.count + count });
};

export async function getSalesReport(from: Ymd, to: Ymd) {
  const orders = await fetchOrders(from, to);
  const live = orders.filter((o) => o.status !== "cancelled");
  const paid = live.filter((o) => o.payment_status === "paid");
  const [items, { data: products }] = await Promise.all([
    fetchItems(live.map((o) => o.id)),
    supabaseAdmin.from("products").select("id, categories(name)"),
  ]);
  const categoryOf = new Map((products ?? []).map((p) => [p.id, (p.categories as unknown as { name: string } | null)?.name ?? "Other"]));

  const sales = paid.reduce((s, o) => s + o.total, 0);
  const kpis = {
    sales,
    orders: live.length,
    paidOrders: paid.length,
    avgOrder: paid.length ? sales / paid.length : 0,
    itemsSold: items.reduce((s, i) => s + i.quantity, 0),
    discounts: live.reduce((s, o) => s + o.discount_amount, 0),
    toCollect: live.filter((o) => o.payment_status !== "paid").reduce((s, o) => s + o.total, 0),
    cancelled: orders.length - live.length,
    serving: servingStats(live),
  };

  // Paid sales per day (per month past ~2 months), counter vs online.
  const unit: "day" | "month" = dayCount(from, to) > 62 ? "month" : "day";
  const keys = unit === "day" ? eachDay(from, to) : eachMonth(from, to);
  const at = new Map(keys.map((k, i) => [k, i]));
  const periods = keys.map((k) => ({ key: k, label: unit === "day" ? shortDate(k) : monthLabel(k), counter: 0, online: 0, orders: 0 }));
  for (const o of paid) {
    const day = nepalDay(o.created_at);
    const b = periods[at.get(unit === "day" ? day : startOfMonth(day)) ?? -1];
    if (!b) continue;
    if (o.placed_by) b.counter += o.total; else b.online += o.total;
    b.orders += 1;
  }

  // When orders come in (Nepal time), all non-cancelled orders.
  const hourCounts = Array.from({ length: 24 }, () => 0);
  live.forEach((o) => { hourCounts[npt(o.created_at).getUTCHours()] += 1; });
  const used = hourCounts.map((c, h) => (c ? h : -1)).filter((h) => h >= 0);
  const hours = used.length
    ? hourCounts.slice(Math.min(...used), Math.max(...used) + 1).map((count, i) => {
        const h = Math.min(...used) + i;
        return { label: `${h % 12 || 12}${h < 12 ? "am" : "pm"}`, count };
      })
    : [];

  const method = new Map<string, { amount: number; count: number }>();
  const type = new Map<string, { amount: number; count: number }>();
  const channel = new Map<string, { amount: number; count: number }>();
  paid.forEach((o) => {
    bump(method, o.payment_method ?? "other", o.total);
    bump(type, o.type, o.total);
    bump(channel, channelOf(o), o.total);
  });
  const category = new Map<string, { amount: number; count: number }>();
  const product = new Map<string, { amount: number; count: number }>();
  items.forEach((i) => {
    bump(category, (i.product_id && categoryOf.get(i.product_id)) || "Other", i.line_total, i.quantity);
    bump(product, i.product_name, i.line_total, i.quantity);
  });

  return {
    orders, items, kpis, unit, periods, hours,
    byMethod: slices(method, (k) => METHOD_LABELS[k] ?? k),
    byType: slices(type, (k) => TYPE_LABELS[k] ?? k),
    byChannel: slices(channel),
    byCategory: slices(category),
    topProducts: [...product.entries()]
      .map(([name, v]) => ({ id: name, name, amount: v.amount, count: v.count }))
      .sort((a, b) => b.count - a.count || b.amount - a.amount),
  };
}

export type SalesReport = Awaited<ReturnType<typeof getSalesReport>>;
