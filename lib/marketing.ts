import "server-only";
import { cookies } from "next/headers";
import { supabaseAdmin, getRewardSettings } from "@/lib/supabase/admin";
import { nepalToday, addMonths, startOfMonth, monthLabel, type Ymd } from "@/lib/dates";
import { CAMPAIGN_COOKIE, metrics, type Channel, type Landing } from "@/lib/marketing-shared";

// Admin → Marketing. Sales count the way Admin → Reports does (paid, not
// cancelled); an order belongs to a campaign if it came through the
// campaign's link (orders.campaign_id) or used its promo code.

const NPT_MS = (5 * 60 + 45) * 60_000;
const nepalDay = (iso: string): Ymd => new Date(new Date(iso).getTime() + NPT_MS).toISOString().slice(0, 10);

/** The campaign that brought this visitor (from their /go/<code> cookie), if it's still running. */
export async function campaignFromCookie(): Promise<string | null> {
  const code = (await cookies()).get(CAMPAIGN_COOKIE)?.value;
  if (!code || !/^[a-z0-9][a-z0-9-]{1,29}$/.test(code)) return null;
  const { data } = await supabaseAdmin.from("marketing_campaigns").select("id").eq("code", code).neq("status", "ended").maybeSingle();
  return data?.id ?? null;
}

/** The campaign an order with this promo code belongs to (the newest one using it). */
export async function campaignForPromo(promoCodeId: string | null): Promise<string | null> {
  if (!promoCodeId) return null;
  const { data } = await supabaseAdmin.from("marketing_campaigns").select("id")
    .eq("promo_code_id", promoCodeId).neq("status", "ended").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data?.id ?? null;
}

export type CampaignRow = {
  id: string; name: string; channel: Channel; code: string; landing_path: Landing; promo_code_id: string | null; promoCode: string | null;
  budget: number | null; starts_on: string; ends_on: string | null; status: "active" | "paused" | "ended"; notes: string | null; clicks: number;
  spend: number; spendThisMonth: number; orders: number; revenue: number; discounts: number; signups: number;
  m: ReturnType<typeof metrics>;
};
export type Alert = { tone: "red" | "amber"; text: string };

type OrderRow = { id: string; created_at: string; total: number; discount_amount: number; discount_label: string | null; points_discount: number; free_item_redeemed: boolean; promo_code_id: string | null; campaign_id: string | null; customer_id: string | null; placed_by: string | null };

async function allPages<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await build(offset, offset + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export async function getMarketing() {
  const today = nepalToday();
  const monthStart = startOfMonth(today);
  const trendStart = addMonths(monthStart, -5);
  const since90 = new Date(Date.now() - 90 * 86400_000).toISOString();

  const [{ data: settingsRow }, { data: campaignRows }, costs, { data: promos }, rewards] = await Promise.all([
    supabaseAdmin.from("marketing_settings").select("gross_margin_pct, monthly_budget").eq("id", 1).maybeSingle(),
    supabaseAdmin.from("marketing_campaigns").select("*").order("created_at", { ascending: false }),
    allPages<{ id: string; campaign_id: string; spent_on: string; amount: number; note: string | null; created_at: string }>((a, b) =>
      supabaseAdmin.from("marketing_costs").select("id, campaign_id, spent_on, amount, note, created_at").order("spent_on", { ascending: false }).range(a, b)),
    supabaseAdmin.from("promo_codes").select("id, code, is_active").order("created_at", { ascending: false }),
    getRewardSettings(),
  ]);
  const margin = Number(settingsRow?.gross_margin_pct ?? 60);
  const monthlyBudget = settingsRow?.monthly_budget != null ? Number(settingsRow.monthly_budget) : null;
  const campaigns = campaignRows ?? [];
  const promoById = new Map((promos ?? []).map((p) => [p.id, p.code as string]));

  // Paid, not-cancelled orders since the start of the trend window (or the oldest campaign).
  const oldestStart = campaigns.reduce<string>((m, c) => (c.starts_on < m ? c.starts_on : m), trendStart);
  const orders = await allPages<OrderRow>((a, b) =>
    supabaseAdmin.from("orders")
      .select("id, created_at, total, discount_amount, discount_label, points_discount, free_item_redeemed, promo_code_id, campaign_id, customer_id, placed_by")
      .eq("payment_status", "paid").neq("status", "cancelled").gte("created_at", `${oldestStart}T00:00:00+05:45`)
      .order("created_at").range(a, b));

  const campaignOf = (o: OrderRow): string | null => {
    if (o.campaign_id) return o.campaign_id;
    if (!o.promo_code_id) return null;
    const c = campaigns.find((x) => x.promo_code_id === o.promo_code_id && nepalDay(o.created_at) >= x.starts_on && (!x.ends_on || nepalDay(o.created_at) <= x.ends_on));
    return c?.id ?? null;
  };

  const { data: signupRows } = await supabaseAdmin.from("profiles").select("signup_campaign_id, created_at").not("signup_campaign_id", "is", null);

  const rows: CampaignRow[] = campaigns.map((c) => {
    const mine = orders.filter((o) => campaignOf(o) === c.id);
    const spendRows = costs.filter((k) => k.campaign_id === c.id);
    const r = {
      spend: spendRows.reduce((s, k) => s + Number(k.amount), 0),
      revenue: mine.reduce((s, o) => s + Number(o.total), 0),
      orders: mine.length,
      signups: (signupRows ?? []).filter((p) => p.signup_campaign_id === c.id).length,
      clicks: Number(c.clicks ?? 0),
    };
    return {
      ...c, budget: c.budget != null ? Number(c.budget) : null, promoCode: c.promo_code_id ? promoById.get(c.promo_code_id) ?? null : null,
      spend: r.spend, spendThisMonth: spendRows.filter((k) => k.spent_on >= monthStart).reduce((s, k) => s + Number(k.amount), 0),
      orders: r.orders, revenue: r.revenue, signups: r.signups,
      discounts: mine.reduce((s, o) => s + Number(o.discount_amount ?? 0), 0),
      m: metrics(r, margin),
    } as CampaignRow;
  });

  // ── This month ───────────────────────────────────────────────
  const monthOrders = orders.filter((o) => nepalDay(o.created_at) >= monthStart);
  const monthAttributed = monthOrders.filter((o) => campaignOf(o));
  const monthSpend = costs.filter((k) => k.spent_on >= monthStart).reduce((s, k) => s + Number(k.amount), 0);
  const byChannel = new Map<string, number>();
  for (const k of costs.filter((x) => x.spent_on >= monthStart)) {
    const ch = campaigns.find((c) => c.id === k.campaign_id)?.channel ?? "other";
    byChannel.set(ch, (byChannel.get(ch) ?? 0) + Number(k.amount));
  }
  const monthSignups = (signupRows ?? []).filter((p) => nepalDay(p.created_at) >= monthStart).length;

  // Offers are a marketing cost too: what discounts, points and free items gave away this month.
  let freeItemPrice = 0;
  if (rewards.free_item_product_id) {
    const { data: fp } = await supabaseAdmin.from("products").select("price").eq("id", rewards.free_item_product_id).maybeSingle();
    freeItemPrice = Number(fp?.price ?? 0);
  }
  const giveaways = new Map<string, number>();
  const give = (k: string, v: number) => { if (v > 0) giveaways.set(k, (giveaways.get(k) ?? 0) + v); };
  for (const o of monthOrders) {
    const d = Number(o.discount_amount ?? 0);
    give(o.discount_label ?? (o.promo_code_id ? "Promo codes" : "Other discounts"), d);
    give("Reward points", Number(o.points_discount ?? 0));
    if (o.free_item_redeemed) give("Free reward items", freeItemPrice);
  }

  // ── Last 6 months: spend vs revenue from campaigns ─────────────
  const trend = Array.from({ length: 6 }, (_, i) => {
    const from = addMonths(trendStart, i), to = addMonths(from, 1);
    return {
      label: monthLabel(from),
      spend: costs.filter((k) => k.spent_on >= from && k.spent_on < to).reduce((s, k) => s + Number(k.amount), 0),
      revenue: orders.filter((o) => { const d = nepalDay(o.created_at); return d >= from && d < to && campaignOf(o); }).reduce((s, o) => s + Number(o.total), 0),
    };
  });

  // ── Numbers for the ROI calculator ────────────────────────────
  const since30 = Date.now() - 30 * 86400_000;
  const recent = orders.filter((o) => new Date(o.created_at).getTime() >= since30);
  const aov = recent.length ? recent.reduce((s, o) => s + Number(o.total), 0) / recent.length : 0;
  const { data: regOrders } = await supabaseAdmin.from("orders").select("customer_id")
    .not("customer_id", "is", null).neq("status", "cancelled").gte("created_at", since90);
  const perCustomer = new Map<string, number>();
  for (const o of regOrders ?? []) perCustomer.set(o.customer_id as string, (perCustomer.get(o.customer_id as string) ?? 0) + 1);
  const ordersPerCustomer = perCustomer.size ? [...perCustomer.values()].reduce((s, n) => s + n, 0) / perCustomer.size : 1;

  // ── Things to look at ─────────────────────────────────────────
  const alerts: Alert[] = [];
  if (monthlyBudget && monthSpend > monthlyBudget) alerts.push({ tone: "red", text: `This month's marketing spend (Rs ${Math.round(monthSpend).toLocaleString("en-IN")}) is over the monthly budget.` });
  else if (monthlyBudget && monthSpend >= monthlyBudget * 0.8) alerts.push({ tone: "amber", text: `${Math.round((monthSpend / monthlyBudget) * 100)}% of this month's marketing budget is used.` });
  for (const c of rows) {
    if (c.budget != null && c.spend > c.budget) alerts.push({ tone: "red", text: `“${c.name}” has spent more than its budget.` });
    const ageDays = (Date.parse(today) - Date.parse(c.starts_on)) / 86400_000;
    if (c.status !== "ended" && c.spend > 0 && ageDays >= 14 && (c.m.roi ?? 0) < 0) alerts.push({ tone: "amber", text: `“${c.name}” isn't paying for itself yet (ROI ${Math.round((c.m.roi ?? 0) * 100)}%) after ${Math.floor(ageDays)} days.` });
    if (c.status === "active" && c.ends_on && c.ends_on < today) alerts.push({ tone: "amber", text: `“${c.name}” is still active after its end date.` });
    if (c.status === "active" && c.spend > 0 && ageDays >= 7 && !c.orders && !c.signups) alerts.push({ tone: "amber", text: `“${c.name}” has had no orders or sign-ups in ${Math.floor(ageDays)} days.` });
  }

  const giveawayTotal = [...giveaways.values()].reduce((s, v) => s + v, 0);
  return {
    margin, monthlyBudget, monthLabel: monthLabel(monthStart),
    campaigns: rows,
    costs: costs.slice(0, 60).map((k) => ({ ...k, amount: Number(k.amount), campaign: campaigns.find((c) => c.id === k.campaign_id)?.name ?? "—" })),
    promos: (promos ?? []).map((p) => ({ id: p.id, code: p.code as string, active: !!p.is_active })),
    month: {
      spend: monthSpend,
      revenue: monthAttributed.reduce((s, o) => s + Number(o.total), 0),
      orders: monthAttributed.length,
      signups: monthSignups,
      allRevenue: monthOrders.reduce((s, o) => s + Number(o.total), 0),
      m: metrics({ spend: monthSpend, revenue: monthAttributed.reduce((s, o) => s + Number(o.total), 0), orders: monthAttributed.length, signups: monthSignups, clicks: 0 }, margin),
      byChannel: [...byChannel.entries()].map(([ch, amount]) => ({ channel: ch as Channel, amount })).sort((a, b) => b.amount - a.amount),
      giveaways: [...giveaways.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
      giveawayTotal,
    },
    trend,
    defaults: { aov: Math.round(aov) || 250, ordersPerCustomer: Math.round(ordersPerCustomer * 10) / 10 || 1, margin },
    alerts,
  };
}
export type MarketingData = Awaited<ReturnType<typeof getMarketing>>;
