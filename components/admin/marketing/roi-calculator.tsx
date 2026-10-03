"use client";
import { useMemo, useState } from "react";
import { Calculator, TrendingUp, TrendingDown } from "lucide-react";
import { planOutcome, pct, times, type Plan } from "@/lib/marketing-shared";
import { npr, cn } from "@/lib/utils";

// "Is this worth doing?" before spending: plan a campaign and see what it
// needs to bring in. Average order, repeat orders and margin start from your
// real numbers (last 30/90 days, Marketing settings).

const EXAMPLES: { label: string; patch: Partial<Plan> }[] = [
  { label: "Facebook boost", patch: { spend: 2000, reach: 20000, conversionPct: 0.5, discountPerOrder: 0 } },
  { label: "200 posters + QR", patch: { spend: 3000, reach: 4000, conversionPct: 2, discountPerOrder: 0 } },
  { label: "Influencer post", patch: { spend: 5000, reach: 15000, conversionPct: 1, discountPerOrder: 20 } },
  { label: "Discount offer", patch: { spend: 0, reach: 1500, conversionPct: 8, discountPerOrder: 40 } },
];

function Field({ id, label, hint, value, onChange, step = 1, suffix }: { id: string; label: string; hint?: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string }) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="flex items-center rounded-xl border border-stone-300 bg-white focus-within:border-brand-orange focus-within:ring-2 focus-within:ring-brand-orange/30">
        <input id={id} type="number" inputMode="decimal" min={0} step={step} value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="min-w-0 flex-1 rounded-xl bg-transparent px-3 py-2.5 text-base outline-none sm:text-sm" />
        {suffix && <span className="pr-3 text-sm text-stone-400">{suffix}</span>}
      </div>
      {hint && <p className="mt-1 text-[11px] text-stone-400">{hint}</p>}
    </div>
  );
}

export default function RoiCalculator({ defaults }: { defaults: { aov: number; ordersPerCustomer: number; margin: number } }) {
  const [p, setP] = useState<Plan>({
    spend: 2000, reach: 20000, conversionPct: 0.5,
    aov: defaults.aov, ordersPerCustomer: Math.max(1, defaults.ordersPerCustomer), discountPerOrder: 0, marginPct: defaults.margin,
  });
  const set = (k: keyof Plan) => (v: number) => setP((x) => ({ ...x, [k]: v }));
  const o = useMemo(() => planOutcome(p), [p]);
  const good = o.net >= 0;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-brand-brown"><Calculator size={19} className="text-brand-orange" /> ROI calculator</h2>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button key={e.label} onClick={() => setP((x) => ({ ...x, ...e.patch }))} className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-600 hover:bg-orange-50 hover:text-brand-orange">{e.label}</button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-stone-500">Plan a campaign before spending. The example buttons are rough starting guesses — change them to your own.</p>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-3">
          <Field id="r-spend" label="Campaign cost" value={p.spend} onChange={set("spend")} step={100} suffix="Rs" />
          <Field id="r-reach" label="People reached" value={p.reach} onChange={set("reach")} step={100} hint="Who sees the ad / poster" />
          <Field id="r-conv" label="% who become customers" value={p.conversionPct} onChange={set("conversionPct")} step={0.1} suffix="%" />
          <Field id="r-aov" label="Average order" value={p.aov} onChange={set("aov")} step={10} suffix="Rs" hint="Your last 30 days" />
          <Field id="r-repeat" label="Orders per customer" value={p.ordersPerCustomer} onChange={set("ordersPerCustomer")} step={0.1} hint="Your regulars: last 90 days" />
          <Field id="r-disc" label="Discount per order" value={p.discountPerOrder} onChange={set("discountPerOrder")} step={5} suffix="Rs" />
          <Field id="r-margin" label="Gross margin" value={p.marginPct} onChange={set("marginPct")} step={1} suffix="%" />
        </div>

        <div className="space-y-3">
          <div className={cn("flex items-center gap-3 rounded-2xl p-4", good ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900")}>
            {good ? <TrendingUp size={28} className="shrink-0 text-green-600" /> : <TrendingDown size={28} className="shrink-0 text-brand-red" />}
            <div>
              <p className="text-sm font-bold">{p.spend === 0 ? "No spend — the discounts are the cost" : good ? "Pays for itself" : "Loses money at these numbers"}</p>
              <p className="font-display text-2xl font-extrabold">{o.net >= 0 ? "+" : "−"}{npr(Math.abs(Math.round(o.net)))} <span className="text-sm font-bold">net return</span></p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["New customers", o.customers.toLocaleString("en-IN")],
              ["Orders", Math.round(o.orders).toLocaleString("en-IN")],
              ["Sales brought in", npr(Math.round(o.revenue))],
              ["Profit from them", npr(Math.round(o.grossProfit))],
              ["ROI", pct(o.roi)],
              ["Return on spend", times(o.roas)],
              ["Cost per customer", o.costPerCustomer != null ? npr(Math.round(o.costPerCustomer)) : "—"],
              ["Break-even customers", o.breakEvenCustomers != null ? o.breakEvenCustomers.toLocaleString("en-IN") : "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-stone-50 px-3 py-2">
                <dt className="text-[11px] font-bold uppercase tracking-wide text-stone-400">{k}</dt>
                <dd className="font-display font-extrabold text-stone-800">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-stone-500">
            Each new customer is worth about <b>{npr(Math.round(o.maxSpendPerCustomer))}</b> in profit
            ({p.ordersPerCustomer} order{p.ordersPerCustomer === 1 ? "" : "s"} × {npr(Math.max(0, p.aov - p.discountPerOrder))} × {p.marginPct}%) — so never pay more than that to win one.
          </p>
        </div>
      </div>
    </section>
  );
}
