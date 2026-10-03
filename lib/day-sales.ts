import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { nepalToday } from "@/lib/dates";

// The POS "Today" sheet: what was sold today (Nepal day) or since the last
// shift close, how it was paid, how much cash should be in the drawer, and
// anything that needs checking before the money is counted. Sales count the
// way Admin → Reports does: paid, not cancelled. The cash expected is
// bucketed by WHEN it was paid (an online order paid on arrival counts in
// the shift that took the money).

export type ShiftClose = {
  at: string; by: string | null; counted_by: string | null; from: string;
  opening_float: number; expected_cash: number; counted_cash: number; difference: number; note: string | null;
};

export type Problem = { kind: "unpaid_handed_over" | "open_long" | "paid_then_cancelled" | "unmarked_paid"; label: string; orders: string[] };

export type DaySales = {
  from: string;           // ISO start of the period
  periodLabel: string;
  orders: number;         // not cancelled
  cancelled: number;
  sales: number;          // paid, not cancelled
  byMethod: { method: string; amount: number; count: number }[];
  counter: { amount: number; count: number };
  online: { amount: number; count: number };
  discounts: number;      // promo / member / student + points
  toCollect: { amount: number; count: number };
  cashReceived: number;   // cash paid in this period — what the drawer should hold above the float
  topItems: { name: string; qty: number }[];
  problems: Problem[];
  closes: ShiftClose[];   // today's earlier closes, newest first
};

type Row = {
  id: string; order_number: string; daily_number: number | null; created_at: string; status: string; type: string;
  total: number; discount_amount: number; points_discount: number; payment_method: string | null; payment_status: string;
  placed_by: string | null; paid_confirmed_at: string | null;
};

const no = (o: Row) => (o.daily_number != null ? `#${String(o.daily_number).padStart(2, "0")}` : o.order_number);

export async function getTodayCloses(): Promise<ShiftClose[]> {
  const dayStart = `${nepalToday()}T00:00:00+05:45`;
  const { data } = await supabaseAdmin.from("audit_logs").select("created_at, new_data, actor:profiles!audit_logs_actor_id_fkey(full_name)")
    .eq("action", "SHIFT_CLOSE").gte("created_at", dayStart).order("created_at", { ascending: false }).limit(20);
  return (data ?? []).map((r) => {
    const d = (r.new_data ?? {}) as Record<string, unknown>;
    return {
      at: r.created_at as string,
      by: (r.actor as unknown as { full_name: string } | null)?.full_name ?? null,
      counted_by: (d.counted_by as string) ?? null,
      from: String(d.from ?? dayStart),
      opening_float: Number(d.opening_float ?? 0),
      expected_cash: Number(d.expected_cash ?? 0),
      counted_cash: Number(d.counted_cash ?? 0),
      difference: Number(d.difference ?? 0),
      note: (d.note as string) ?? null,
    };
  });
}

export async function getDaySales(period: "day" | "shift" = "day"): Promise<DaySales> {
  const dayStart = `${nepalToday()}T00:00:00+05:45`;
  const closes = await getTodayCloses();
  const lastClose = closes[0]?.at ?? null;
  const from = new Date(period === "shift" && lastClose ? lastClose : dayStart).toISOString();
  const fromMs = Date.parse(from);
  const ms = (iso: string) => Date.parse(iso);
  const periodLabel = period === "shift" && lastClose
    ? `Since ${new Date(lastClose).toLocaleTimeString("en-GB", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit", hour12: true })}`
    : "Today";

  // Orders placed in the period, plus older ones PAID in it (cash taken this shift).
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin.from("orders")
      .select("id, order_number, daily_number, created_at, status, type, total, discount_amount, points_discount, payment_method, payment_status, placed_by, paid_confirmed_at")
      .or(`created_at.gte.${from},paid_confirmed_at.gte.${from}`)
      .order("created_at").range(offset, offset + 999);
    if (error) throw new Error(`Couldn't load today's orders: ${error.message}`);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  const inPeriod = rows.filter((o) => ms(o.created_at) >= fromMs);
  const live = inPeriod.filter((o) => o.status !== "cancelled");
  const paid = live.filter((o) => o.payment_status === "paid");

  const methods = new Map<string, { amount: number; count: number }>();
  const counter = { amount: 0, count: 0 };
  const online = { amount: 0, count: 0 };
  for (const o of paid) {
    const m = methods.get(o.payment_method ?? "other") ?? { amount: 0, count: 0 };
    m.amount += Number(o.total); m.count += 1;
    methods.set(o.payment_method ?? "other", m);
    const ch = o.placed_by ? counter : online;
    ch.amount += Number(o.total); ch.count += 1;
  }
  const unpaid = live.filter((o) => o.payment_status !== "paid");

  // Cash the drawer took in this period: cash orders whose payment landed in it.
  const paidAt = (o: Row) => o.paid_confirmed_at ?? o.created_at;
  const cashReceived = rows
    .filter((o) => o.status !== "cancelled" && o.payment_status === "paid" && o.payment_method === "cash" && ms(paidAt(o)) >= fromMs)
    .reduce((s, o) => s + Number(o.total), 0);

  const { data: items } = live.length
    ? await supabaseAdmin.from("order_items").select("product_name, quantity").in("order_id", live.map((o) => o.id).slice(0, 1000))
    : { data: [] };
  const qty = new Map<string, number>();
  for (const i of items ?? []) qty.set(i.product_name, (qty.get(i.product_name) ?? 0) + Number(i.quantity));

  const hourAgo = Date.now() - 60 * 60_000;
  const problems: Problem[] = [
    {
      kind: "unpaid_handed_over", label: "Handed over but not marked paid — was the money taken?",
      orders: live.filter((o) => o.status === "delivered" && o.payment_status !== "paid").map(no),
    },
    {
      kind: "paid_then_cancelled", label: "Cancelled after being paid — check the refund",
      orders: inPeriod.filter((o) => o.status === "cancelled" && o.payment_status === "paid").map(no),
    },
    {
      kind: "open_long", label: "Still open after an hour — finish or cancel them",
      orders: live.filter((o) => !["delivered", "cancelled"].includes(o.status) && ms(o.created_at) < hourAgo).map(no),
    },
  ].filter((p) => p.orders.length) as Problem[];

  // "Paid" taken back today — usually a mis-tap, but worth a look before counting.
  const { data: unmarked } = await supabaseAdmin.from("audit_logs").select("target_id").eq("action", "MARK_ORDER_UNPAID").gte("created_at", from);
  if (unmarked?.length) {
    const ids = new Set(unmarked.map((u) => u.target_id));
    const hit = rows.filter((o) => ids.has(o.id)).map(no);
    if (hit.length) problems.push({ kind: "unmarked_paid", label: "Marked paid, then un-marked — make sure that's right", orders: hit });
  }

  return {
    from, periodLabel,
    orders: live.length,
    cancelled: inPeriod.length - live.length,
    sales: paid.reduce((s, o) => s + Number(o.total), 0),
    byMethod: [...methods.entries()].map(([method, v]) => ({ method, ...v })).sort((a, b) => b.amount - a.amount),
    counter, online,
    discounts: live.reduce((s, o) => s + Number(o.discount_amount ?? 0) + Number(o.points_discount ?? 0), 0),
    toCollect: { amount: unpaid.reduce((s, o) => s + Number(o.total), 0), count: unpaid.length },
    cashReceived,
    topItems: [...qty.entries()].map(([name, n]) => ({ name, qty: n })).sort((a, b) => b.qty - a.qty).slice(0, 8),
    problems,
    closes,
  };
}
