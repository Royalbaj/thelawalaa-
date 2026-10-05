import "server-only";
import { supabaseAdmin, getRewardSettings } from "@/lib/supabase/admin";
import { nepalToday } from "@/lib/dates";
import { STAFF_LABEL } from "@/lib/discounts";
import { CATEGORY_KEYS, CATEGORY_SHORT, roiOf, ymOf, monthStart, shiftMonth, monthName, monthShort, type Category, type PaymentMethod, type Ym } from "@/lib/marketing-shared";

// Admin → Marketing & ROI (migration 032): the marketing budget per month,
// every expense and return recorded by hand, and what that adds up to.
// Shop sales come from the orders (paid, not cancelled — like Reports) only
// to show marketing as a share of sales.

export type Entry = {
  id: string; kind: "expense" | "return"; entry_date: string; category: Category; activity_id: string | null; activity: string | null;
  amount: number; new_customers: number | null; payment_method: PaymentMethod | null; note: string | null;
};
export type Activity = {
  id: string; name: string; category: Category; budget: number | null; starts_on: string; ends_on: string | null;
  status: "active" | "paused" | "ended"; notes: string | null;
  spent: number; returns: number; newCustomers: number; r: ReturnType<typeof roiOf>; budgetUse: number | null;
};
export type Alert = { tone: "red" | "amber"; text: string };

const startIso = (ymd: string) => `${ymd}T00:00:00+05:45`;

async function allEntries() {
  const out: Omit<Entry, "activity">[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin.from("marketing_entries")
      .select("id, kind, entry_date, category, activity_id, amount, new_customers, payment_method, note")
      .order("entry_date", { ascending: false }).order("created_at", { ascending: false }).range(offset, offset + 999);
    if (error) throw new Error(`Couldn't load marketing entries: ${error.message}`);
    out.push(...((data ?? []) as Omit<Entry, "activity">[]).map((e) => ({ ...e, amount: Number(e.amount) })));
    if (!data || data.length < 1000) return out;
  }
}

async function paidSales(fromYmd: string, toYmd: string) {
  let total = 0;
  const rows: { total: number; discount_amount: number; discount_label: string | null; points_discount: number; free_item_redeemed: boolean; promo_code_id: string | null; customer_id: string | null }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabaseAdmin.from("orders")
      .select("total, discount_amount, discount_label, points_discount, free_item_redeemed, promo_code_id, customer_id")
      .eq("payment_status", "paid").neq("status", "cancelled")
      .gte("created_at", startIso(fromYmd)).lt("created_at", startIso(toYmd)).range(offset, offset + 999);
    if (error) throw new Error(`Couldn't load sales: ${error.message}`);
    for (const o of data ?? []) { total += Number(o.total); rows.push(o as never); }
    if (!data || data.length < 1000) return { total, rows };
  }
}

export async function getMarketing(ymInput?: string) {
  const thisYm = ymOf(nepalToday());
  const ym: Ym = ymInput && /^\d{4}-\d{2}$/.test(ymInput) && ymInput <= thisYm ? ymInput : thisYm;
  const from = monthStart(ym), to = monthStart(shiftMonth(ym, 1));
  const prevYm = shiftMonth(ym, -1);

  const [{ data: settingsRow }, { data: budgetRows }, { data: activityRows }, entriesRaw, sales, prevSales, rewards] = await Promise.all([
    supabaseAdmin.from("marketing_settings").select("gross_margin_pct").eq("id", 1).maybeSingle(),
    supabaseAdmin.from("marketing_budgets").select("month, category, amount").in("month", [from, monthStart(prevYm)]),
    supabaseAdmin.from("marketing_activities").select("id, name, category, budget, starts_on, ends_on, status, notes").order("starts_on", { ascending: false }),
    allEntries(),
    paidSales(from, to),
    paidSales(monthStart(prevYm), from),
    getRewardSettings(),
  ]);
  const margin = Number(settingsRow?.gross_margin_pct ?? 60);
  const activityName = new Map((activityRows ?? []).map((a) => [a.id, a.name as string]));
  const entries: Entry[] = entriesRaw.map((e) => ({ ...e, activity: e.activity_id ? activityName.get(e.activity_id) ?? null : null }));

  const budgetFor = (monthYmd: string) => {
    const rows = (budgetRows ?? []).filter((b) => b.month === monthYmd);
    const byCategory = Object.fromEntries(rows.filter((b) => b.category !== "total").map((b) => [b.category, Number(b.amount)])) as Partial<Record<Category, number>>;
    const total = rows.find((b) => b.category === "total");
    return { total: total ? Number(total.amount) : null, byCategory };
  };
  const budget = budgetFor(from);
  const prevBudget = budgetFor(monthStart(prevYm));

  // ── This month ───────────────────────────────────────────────
  const inMonth = entries.filter((e) => e.entry_date >= from && e.entry_date < to);
  const expenses = inMonth.filter((e) => e.kind === "expense");
  const returns = inMonth.filter((e) => e.kind === "return");
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const returned = returns.reduce((s, e) => s + e.amount, 0);
  const newCustomers = returns.reduce((s, e) => s + (e.new_customers ?? 0), 0);
  const byCategory = CATEGORY_KEYS.map((c) => {
    const s = expenses.filter((e) => e.category === c).reduce((t, e) => t + e.amount, 0);
    const r = returns.filter((e) => e.category === c).reduce((t, e) => t + e.amount, 0);
    return { category: c, spent: s, returns: r, budget: budget.byCategory[c] ?? null, r: roiOf(s, r, margin) };
  }).filter((c) => c.spent || c.returns || c.budget);
  const byMethod = (["cash", "bank", "qr", "other"] as PaymentMethod[])
    .map((m) => ({ method: m, amount: expenses.filter((e) => (e.payment_method ?? "other") === m).reduce((s, e) => s + e.amount, 0) }))
    .filter((m) => m.amount > 0);

  // Customers who signed up this month (and last), for "cost per new customer".
  const [{ count: signups }, { count: prevSignups }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer").gte("created_at", startIso(from)).lt("created_at", startIso(to)),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer").gte("created_at", startIso(monthStart(prevYm))).lt("created_at", startIso(from)),
  ]);

  // Offers given at the till / online this month — discounts are a marketing cost too.
  let freeItemPrice = 0;
  if (rewards.free_item_product_id) {
    const { data: fp } = await supabaseAdmin.from("products").select("price").eq("id", rewards.free_item_product_id).maybeSingle();
    freeItemPrice = Number(fp?.price ?? 0);
  }
  const giveaways = new Map<string, number>();
  const give = (k: string, v: number) => { if (v > 0) giveaways.set(k, (giveaways.get(k) ?? 0) + v); };
  for (const o of sales.rows) {
    // Staff sales' free items are a staff cost, not an offer to customers.
    if (o.discount_label !== STAFF_LABEL) give(o.discount_label ?? (o.promo_code_id ? "Promo codes" : "Other discounts"), Number(o.discount_amount ?? 0));
    give("Reward points", Number(o.points_discount ?? 0));
    if (o.free_item_redeemed) give("Free reward items", freeItemPrice);
  }
  const giveawayTotal = [...giveaways.values()].reduce((s, v) => s + v, 0);

  // ── Last 6 months ────────────────────────────────────────────
  const { data: trendBudgets } = await supabaseAdmin.from("marketing_budgets").select("month, amount")
    .eq("category", "total").gte("month", monthStart(shiftMonth(ym, -5))).lte("month", from);
  const trend = Array.from({ length: 6 }, (_, i) => {
    const m = shiftMonth(ym, i - 5), f = monthStart(m), t = monthStart(shiftMonth(m, 1));
    const es = entries.filter((e) => e.entry_date >= f && e.entry_date < t);
    return {
      label: monthShort(m),
      expenses: es.filter((e) => e.kind === "expense").reduce((s, e) => s + e.amount, 0),
      returns: es.filter((e) => e.kind === "return").reduce((s, e) => s + e.amount, 0),
      budget: Number((trendBudgets ?? []).find((b) => b.month === f)?.amount ?? 0),
    };
  });

  // ── Activities (all time) ────────────────────────────────────
  const activities: Activity[] = (activityRows ?? []).map((a) => {
    const es = entries.filter((e) => e.activity_id === a.id);
    const s = es.filter((e) => e.kind === "expense").reduce((t, e) => t + e.amount, 0);
    const r = es.filter((e) => e.kind === "return").reduce((t, e) => t + e.amount, 0);
    const b = a.budget != null ? Number(a.budget) : null;
    return {
      ...a, category: a.category as Category, budget: b, status: a.status as Activity["status"],
      spent: s, returns: r, newCustomers: es.reduce((t, e) => t + (e.kind === "return" ? e.new_customers ?? 0 : 0), 0),
      r: roiOf(s, r, margin), budgetUse: b ? s / b : null,
    };
  });

  // ── Things to look at ────────────────────────────────────────
  const alerts: Alert[] = [];
  const isThisMonth = ym === thisYm;
  if (budget.total != null && spent > budget.total) alerts.push({ tone: "red", text: `Marketing spend is over this month's budget by Rs ${Math.round(spent - budget.total).toLocaleString("en-IN")}.` });
  else if (budget.total && spent >= budget.total * 0.8) alerts.push({ tone: "amber", text: `${Math.round((spent / budget.total) * 100)}% of this month's marketing budget is used.` });
  if (isThisMonth && budget.total == null && Object.keys(budget.byCategory).length === 0) alerts.push({ tone: "amber", text: "No marketing budget is set for this month yet." });
  for (const c of byCategory) if (c.budget != null && c.spent > c.budget) alerts.push({ tone: "red", text: `${CATEGORY_SHORT[c.category]} spending is over its budget for the month.` });
  for (const a of activities) {
    if (a.status !== "ended" && a.budget != null && a.spent > a.budget) alerts.push({ tone: "red", text: `“${a.name}” has spent more than its budget.` });
    if (a.status === "active" && a.ends_on && a.ends_on < nepalToday()) alerts.push({ tone: "amber", text: `“${a.name}” is past its end date — mark it done when it's finished.` });
  }
  if (spent > 0 && returned === 0) alerts.push({ tone: "amber", text: "Money was spent this month but no returns are recorded yet — add what it brought in." });

  // ── ROI planner starting numbers ─────────────────────────────
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
  const since90 = new Date(Date.now() - 90 * 86400_000).toISOString();
  const [{ data: recent }, { data: regOrders }] = await Promise.all([
    supabaseAdmin.from("orders").select("total").eq("payment_status", "paid").neq("status", "cancelled").gte("created_at", since30).limit(5000),
    supabaseAdmin.from("orders").select("customer_id").not("customer_id", "is", null).neq("status", "cancelled").gte("created_at", since90).limit(5000),
  ]);
  const aov = recent?.length ? recent.reduce((s, o) => s + Number(o.total), 0) / recent.length : 0;
  const perCustomer = new Map<string, number>();
  for (const o of regOrders ?? []) perCustomer.set(o.customer_id as string, (perCustomer.get(o.customer_id as string) ?? 0) + 1);
  const ordersPerCustomer = perCustomer.size ? [...perCustomer.values()].reduce((s, n) => s + n, 0) / perCustomer.size : 1;

  return {
    ym, label: monthName(ym), prevYm, nextYm: ym < thisYm ? shiftMonth(ym, 1) : null, isThisMonth, margin,
    budget, prevBudget,
    month: {
      spent, returned, newCustomers, ...roiOf(spent, returned, margin),
      remaining: budget.total != null ? budget.total - spent : null,
      budgetUse: budget.total ? spent / budget.total : null,
      byCategory, byMethod,
      entries: inMonth,
    },
    sales: { thisMonth: sales.total, lastMonth: prevSales.total, share: sales.total ? spent / sales.total : null },
    signups: { thisMonth: signups ?? 0, lastMonth: prevSignups ?? 0, costEach: signups ? spent / signups : null },
    giveaways: [...giveaways.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
    giveawayTotal,
    trend,
    activities,
    alerts,
    defaults: { aov: Math.round(aov) || 250, ordersPerCustomer: Math.round(ordersPerCustomer * 10) / 10 || 1, margin },
  };
}
export type MarketingData = Awaited<ReturnType<typeof getMarketing>>;
