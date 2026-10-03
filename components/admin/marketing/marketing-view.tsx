import { AlertTriangle, Wallet, TrendingUp, UserPlus, ShoppingBag, Gift, Percent, Info } from "lucide-react";
import type { MarketingData } from "@/lib/marketing";
import { CHANNELS, pct, times } from "@/lib/marketing-shared";
import { npr, cn } from "@/lib/utils";
import { Columns, SERIES_1, SERIES_2 } from "@/components/admin/sales-charts";
import BarList from "@/components/admin/bar-list";
import { NewCampaignButton, CampaignCard, NoCampaigns } from "@/components/admin/marketing/campaigns";
import { CostForm, CostList, MarketingSettingsForm } from "@/components/admin/marketing/costs";
import RoiCalculator from "@/components/admin/marketing/roi-calculator";

/** Admin → Marketing, drawn from getMarketing()'s numbers. */
export default function MarketingView({ d }: { d: MarketingData }) {
  const { month } = d;
  const budgetUse = d.monthlyBudget ? month.spend / d.monthlyBudget : null;
  const live = d.campaigns.filter((c) => c.status !== "ended");
  const ended = d.campaigns.filter((c) => c.status === "ended");
  const channelTotal = month.byChannel.reduce((s, x) => s + x.amount, 0);

  const tiles = [
    { icon: Wallet, label: "Marketing spend", value: npr(month.spend), sub: d.monthlyBudget ? `of ${npr(d.monthlyBudget)} budget (${pct(budgetUse)})` : "no monthly budget set", tint: budgetUse != null && budgetUse > 1 ? "text-brand-red" : "text-brand-brown" },
    { icon: TrendingUp, label: "Sales from campaigns", value: npr(month.revenue), sub: `${month.orders} order${month.orders === 1 ? "" : "s"} · ${pct(month.allRevenue ? month.revenue / month.allRevenue : null)} of all sales`, tint: "text-blue-800" },
    { icon: Percent, label: "Marketing ROI", value: pct(month.m.roi), sub: `return on spend ${times(month.m.roas)}`, tint: month.m.roi == null ? "text-stone-400" : month.m.roi >= 0 ? "text-green-700" : "text-brand-red" },
    { icon: UserPlus, label: "Sign-ups from campaigns", value: String(month.signups), sub: month.m.costPerSignup != null ? `${npr(Math.round(month.m.costPerSignup))} each` : "—", tint: "text-brand-brown" },
    { icon: ShoppingBag, label: "Cost per order", value: month.m.costPerOrder != null ? npr(Math.round(month.m.costPerOrder)) : "—", sub: "spend ÷ campaign orders", tint: "text-brand-brown" },
    { icon: Gift, label: "Offers given away", value: npr(month.giveawayTotal), sub: "discounts, points, free items", tint: "text-amber-700" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-brown">Marketing</h1>
          <p className="mt-0.5 text-sm text-stone-500">What you spend on ads, posters and offers — and what each one brings back. {d.monthLabel} so far.</p>
        </div>
        <NewCampaignButton promos={d.promos} />
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
      {d.monthlyBudget != null && (
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
          <div className="flex justify-between text-xs font-bold text-stone-500">
            <span>Monthly budget</span><span>{npr(month.spend)} of {npr(d.monthlyBudget)} · {npr(Math.max(0, d.monthlyBudget - month.spend))} left</span>
          </div>
          <div className="mt-2 h-3 rounded-full bg-stone-100">
            <div className={cn("h-3 rounded-full", budgetUse! > 1 ? "bg-brand-red" : budgetUse! > 0.8 ? "bg-amber-500" : "bg-brand-orange")} style={{ width: `${Math.min(100, Math.max(1, budgetUse! * 100))}%` }} />
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-brand-brown">Campaigns</h2>
          {d.campaigns.length === 0 ? <NoCampaigns promos={d.promos} /> : (
            <div className="grid gap-3 xl:grid-cols-2">
              {live.map((c) => <CampaignCard key={c.id} c={c} promos={d.promos} />)}
            </div>
          )}
          {ended.length > 0 && (
            <details className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
              <summary className="cursor-pointer text-sm font-bold text-stone-600">Ended campaigns ({ended.length})</summary>
              <div className="mt-3 grid gap-3 xl:grid-cols-2">{ended.map((c) => <CampaignCard key={c.id} c={c} promos={d.promos} />)}</div>
            </details>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
            <h2 className="mb-3 font-display font-bold text-brand-brown">Log a cost</h2>
            <CostForm campaigns={d.campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status }))} />
          </section>
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
            <h2 className="mb-3 font-display font-bold text-brand-brown">Spend by channel <span className="text-xs font-normal text-stone-400">· {d.monthLabel}</span></h2>
            <BarList color={SERIES_2} empty="Nothing spent this month yet."
              rows={month.byChannel.map((x) => ({ id: x.channel, name: CHANNELS[x.channel] ?? x.channel, amount: x.amount, share: channelTotal ? x.amount / channelTotal : 0 }))} />
          </section>
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
            <h2 className="font-display font-bold text-brand-brown">Offers given away <span className="text-xs font-normal text-stone-400">· {d.monthLabel}</span></h2>
            <p className="mb-3 text-xs text-stone-500">Discounts are a marketing cost too — they come off every bill.</p>
            <BarList color={SERIES_1} empty="No discounts given this month."
              rows={month.giveaways.map((g) => ({ id: g.name, name: g.name, amount: g.amount, share: month.giveawayTotal ? g.amount / month.giveawayTotal : 0 }))} />
          </section>
        </aside>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
        <h2 className="font-display text-lg font-bold text-brand-brown">Spend vs sales from campaigns</h2>
        <p className="mb-3 text-xs text-stone-500">Last 6 months. Sales count paid, not-cancelled orders that came through a campaign link or its promo code.</p>
        <Columns data={d.trend} tableLabel="Month" empty="No marketing spend or campaign sales yet."
          series={[{ key: "spend", label: "Marketing spend", color: SERIES_2 }, { key: "revenue", label: "Sales from campaigns", color: SERIES_1 }]} />
      </section>

      <RoiCalculator defaults={d.defaults} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
          <h2 className="mb-2 font-display font-bold text-brand-brown">Costs logged</h2>
          <CostList costs={d.costs} />
        </section>
        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
          <h2 className="font-display font-bold text-brand-brown">Settings</h2>
          <MarketingSettingsForm margin={d.margin} monthlyBudget={d.monthlyBudget} />
          <div className="rounded-xl bg-stone-50 p-3 text-xs leading-relaxed text-stone-600">
            <p className="mb-1 flex items-center gap-1.5 font-bold text-stone-700"><Info size={13} /> How it&apos;s worked out</p>
            <p><b>Sales from a campaign</b>: paid orders made within 30 days of visiting its link (or QR), or using its promo code. Counter (POS) sales aren&apos;t linked to campaigns.</p>
            <p className="mt-1"><b>Profit</b> = sales × gross margin. <b>ROI</b> = (profit − spend) ÷ spend. <b>Return on spend</b> = sales ÷ spend.</p>
            <p className="mt-1">The Accounts app is still where all money in/out is written down — log marketing there too if you keep your books there.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
