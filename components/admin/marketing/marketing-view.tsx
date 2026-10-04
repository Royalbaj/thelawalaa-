import Link from "next/link";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, PiggyBank, Wallet, ArrowDownCircle, Scale, Percent, Store, Info, UserPlus, Gift } from "lucide-react";
import type { MarketingData } from "@/lib/marketing";
import { CATEGORY_SHORT, PAYMENT_METHODS, pct, times } from "@/lib/marketing-shared";
import { npr, cn } from "@/lib/utils";
import { Columns, SERIES_1, SERIES_2 } from "@/components/admin/sales-charts";
import BarList from "@/components/admin/bar-list";
import { EntryForm, EntryList } from "./entries";
import { BudgetButton, MarginForm } from "./budget";
import { ActivityList, NewActivityButton } from "./activities";
import RoiCalculator from "./roi-calculator";

const card = "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100";

/** Admin → Marketing & ROI: the month's budget, spending, returns and ROI. */
export default function MarketingView({ d }: { d: MarketingData }) {
  const { month } = d;
  const over = month.budgetUse != null && month.budgetUse > 1;
  const activityOptions = d.activities.map((a) => ({ id: a.id, name: a.name, category: a.category, status: a.status }));
  // New entries default to today in the current month, else the 1st of the month being viewed.
  const defaultDate = d.isThisMonth ? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" }) : `${d.ym}-01`;
  const salesChange = d.sales.lastMonth ? (d.sales.thisMonth - d.sales.lastMonth) / d.sales.lastMonth : null;

  const tiles = [
    { icon: PiggyBank, label: "Budget", value: d.budget.total != null ? npr(d.budget.total) : "Not set", sub: d.budget.total != null ? `${npr(Math.max(0, month.remaining ?? 0))} left` : "set one for this month", tint: "text-brand-brown" },
    { icon: Wallet, label: "Spent", value: npr(month.spent), sub: month.budgetUse != null ? `${pct(month.budgetUse)} of budget` : `${month.entries.filter((e) => e.kind === "expense").length} expenses`, tint: over ? "text-brand-red" : "text-brand-orange" },
    { icon: ArrowDownCircle, label: "Returns", value: npr(month.returned), sub: month.newCustomers ? `${month.newCustomers} new customers` : `${month.entries.filter((e) => e.kind === "return").length} recorded`, tint: "text-blue-700" },
    { icon: Scale, label: "Net return", value: `${month.net >= 0 ? "+" : "−"}${npr(Math.abs(month.net))}`, sub: `back per Rs 1 spent: ${times(month.perRupee)}`, tint: month.net >= 0 ? "text-green-700" : "text-brand-red" },
    { icon: Percent, label: "ROI", value: pct(month.roi), sub: `on profit: ${pct(month.profitRoi)}`, tint: month.roi == null ? "text-stone-400" : month.roi >= 0 ? "text-green-700" : "text-brand-red" },
    { icon: Store, label: "Of shop sales", value: pct(d.sales.share, 1), sub: `marketing ÷ ${npr(d.sales.thisMonth)} sales`, tint: "text-brand-brown" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-brown">Marketing budget &amp; ROI</h1>
          <p className="mt-0.5 text-sm text-stone-500">Set the budget, record what you spend on marketing and what it brings back.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full bg-white p-1 ring-1 ring-stone-200">
            <Link href={`/admin/marketing?month=${d.prevYm}`} aria-label="Previous month" className="rounded-full p-1.5 text-stone-500 hover:bg-stone-100"><ChevronLeft size={18} /></Link>
            <span className="min-w-[8.5rem] text-center text-sm font-bold text-brand-brown">{d.label}</span>
            {d.nextYm ? (
              <Link href={`/admin/marketing?month=${d.nextYm}`} aria-label="Next month" className="rounded-full p-1.5 text-stone-500 hover:bg-stone-100"><ChevronRight size={18} /></Link>
            ) : <span className="p-1.5 text-stone-200"><ChevronRight size={18} /></span>}
          </div>
          <a href={`/admin/marketing/export?month=${d.ym}`} className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold text-brand-brown ring-1 ring-stone-200 hover:bg-stone-50"><Download size={15} /> CSV</a>
          <BudgetButton ym={d.ym} label={d.label} budget={d.budget} prevBudget={d.prevBudget} prevLabel={new Date(`${d.prevYm}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" })} />
        </div>
      </div>

      {d.alerts.length > 0 && (
        <ul className="space-y-2">
          {d.alerts.map((a, i) => (
            <li key={i} className={cn("flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-bold", a.tone === "red" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900")}>
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {a.text}
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-stone-400"><t.icon size={13} /> {t.label}</p>
            <p className={cn("mt-1 font-display text-xl font-extrabold", t.tint)}>{t.value}</p>
            <p className="text-[11px] text-stone-500">{t.sub}</p>
          </div>
        ))}
      </div>
      {d.budget.total != null && (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
          <div className="flex flex-wrap justify-between gap-2 text-xs font-bold text-stone-500">
            <span>{d.label} budget</span>
            <span className={cn(over && "text-brand-red")}>{npr(month.spent)} of {npr(d.budget.total)} · {over ? `${npr(month.spent - d.budget.total)} over` : `${npr(month.remaining ?? 0)} left`}</span>
          </div>
          <div className="mt-2 h-3 rounded-full bg-stone-100">
            <div className={cn("h-3 rounded-full", over ? "bg-brand-red" : (month.budgetUse ?? 0) > 0.8 ? "bg-amber-500" : "bg-brand-orange")}
              style={{ width: `${Math.min(100, Math.max(1, (month.budgetUse ?? 0) * 100))}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)] [&>*]:min-w-0">
        <section className={cn(card, "h-fit")}>
          <h2 className="mb-3 font-display text-lg font-bold text-brand-brown">Record</h2>
          <EntryForm activities={activityOptions} defaultDate={defaultDate} />
        </section>
        <div className="space-y-6">
          <section className={card}>
            <h2 className="mb-3 font-display text-lg font-bold text-brand-brown">By category <span className="text-xs font-normal text-stone-400">· {d.label}</span></h2>
            {month.byCategory.length === 0 ? <p className="py-6 text-center text-sm text-stone-400">Nothing spent or budgeted yet.</p> : (
              <ul className="space-y-3">
                {month.byCategory.map((c) => {
                  const use = c.budget ? c.spent / c.budget : null;
                  return (
                    <li key={c.category}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                        <span className="font-bold text-stone-700">{CATEGORY_SHORT[c.category]}</span>
                        <span className="text-xs text-stone-500">
                          spent <b className="text-stone-800">{npr(c.spent)}</b>{c.budget != null ? <> of {npr(c.budget)}</> : null}
                          {c.returns > 0 && <> · returns <b className="text-blue-700">{npr(c.returns)}</b></>}
                          {c.r.roi != null && <> · ROI <b className={c.r.roi >= 0 ? "text-green-700" : "text-brand-red"}>{pct(c.r.roi)}</b></>}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-stone-100">
                        <div className={cn("h-2 rounded-full", use != null && use > 1 ? "bg-brand-red" : use != null && use > 0.8 ? "bg-amber-500" : "bg-brand-orange")}
                          style={{ width: `${use != null ? Math.min(100, Math.max(2, use * 100)) : c.spent ? 100 : 0}%`, opacity: use == null ? 0.35 : 1 }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className={card}>
            <h2 className="mb-2 font-display text-lg font-bold text-brand-brown">Expenses &amp; returns <span className="text-xs font-normal text-stone-400">· {d.label}</span></h2>
            <EntryList entries={month.entries} activities={activityOptions} />
          </section>
        </div>
      </div>

      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-brand-brown">Activities</h2>
            <p className="text-xs text-stone-500">Each activity&apos;s own budget, spending and returns — all time.</p>
          </div>
          <NewActivityButton />
        </div>
        <ActivityList activities={d.activities} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] [&>*]:min-w-0">
        <section className={card}>
          <h2 className="font-display text-lg font-bold text-brand-brown">Spent vs returns</h2>
          <p className="mb-3 text-xs text-stone-500">The last 6 months.</p>
          <Columns data={d.trend} tableLabel="Month" empty="Nothing recorded in these months yet."
            series={[{ key: "expenses", label: "Spent", color: SERIES_2 }, { key: "returns", label: "Returns", color: SERIES_1 }]} />
        </section>
        <section className={cn(card, "space-y-4")}>
          <h2 className="font-display text-lg font-bold text-brand-brown">Other numbers <span className="text-xs font-normal text-stone-400">· {d.label}</span></h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-stone-50 px-3 py-2"><dt className="flex items-center gap-1 text-[11px] font-bold uppercase text-stone-400"><Store size={11} /> Shop sales</dt>
              <dd className="font-display font-extrabold">{npr(d.sales.thisMonth)}</dd>
              <dd className="text-[11px] text-stone-500">{salesChange == null ? "—" : `${salesChange >= 0 ? "▲" : "▼"} ${pct(Math.abs(salesChange))} vs last month`}</dd></div>
            <div className="rounded-xl bg-stone-50 px-3 py-2"><dt className="flex items-center gap-1 text-[11px] font-bold uppercase text-stone-400"><UserPlus size={11} /> New sign-ups</dt>
              <dd className="font-display font-extrabold">{d.signups.thisMonth}</dd>
              <dd className="text-[11px] text-stone-500">last month {d.signups.lastMonth}{d.signups.costEach != null ? ` · ${npr(Math.round(d.signups.costEach))} spent each` : ""}</dd></div>
          </dl>
          {month.byMethod.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-bold text-stone-500">Spent by payment</p>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">{month.byMethod.map((m) => <span key={m.method}>{PAYMENT_METHODS[m.method]} <b>{npr(m.amount)}</b></span>)}</p>
            </div>
          )}
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-stone-500"><Gift size={13} /> Offers given at the till &amp; online: <b className="text-stone-800">{npr(d.giveawayTotal)}</b></p>
            <p className="mb-2 text-[11px] text-stone-400">Discounts, reward points and free items customers used — counted automatically, not part of the budget.</p>
            <BarList color={SERIES_1} empty="No discounts this month."
              rows={d.giveaways.map((g) => ({ id: g.name, name: g.name, amount: g.amount, share: d.giveawayTotal ? g.amount / d.giveawayTotal : 0 }))} />
          </div>
        </section>
      </div>

      <RoiCalculator defaults={d.defaults} />

      <section className={cn(card, "grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0")}>
        <div className="space-y-2">
          <h2 className="font-display text-lg font-bold text-brand-brown">Settings</h2>
          <MarginForm margin={d.margin} />
          <p className="text-xs text-stone-500">Gross margin = what&apos;s left of each Rs 100 of sales after ingredients and packaging. Used for &ldquo;ROI on profit&rdquo; and the planner.</p>
        </div>
        <div className="rounded-xl bg-stone-50 p-3 text-xs leading-relaxed text-stone-600">
          <p className="mb-1 flex items-center gap-1.5 font-bold text-stone-700"><Info size={13} /> How it&apos;s worked out</p>
          <p><b>Returns</b> are what you record: the extra sales or income a marketing expense brought.</p>
          <p className="mt-1"><b>Net</b> = returns − spent. <b>ROI</b> = net ÷ spent (100% = every rupee came back doubled). <b>ROI on profit</b> counts returns at your gross margin.</p>
          <p className="mt-1"><b>Of shop sales</b> = marketing spent ÷ the month&apos;s paid sales (Admin → Reports figures). A common guide for restaurants is 3–6%.</p>
          <p className="mt-1">The Accounts app stays the main money book — record marketing there too if you keep all spending there.</p>
        </div>
      </section>
    </div>
  );
}
