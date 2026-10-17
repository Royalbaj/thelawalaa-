import Link from "next/link";
import { requireAuth } from "@/lib/supabase/server";
import { resolveRange, rangeQuery, prettyDate, shortDate, nepalToday, type RangeKey } from "@/lib/dates";
import { getCategories, getEntries, byCategory, byPeriod, runningCost, isOperating, SERIES } from "@/lib/ledger";
import { InOutColumns } from "@/components/charts";
import BarList from "@/components/bar-list";
import RangePicker from "@/components/range-picker";
import { DaySalesForm, RunningToggle } from "@/components/running-cost";
import { ReportTabs } from "@/components/report-tabs";
import { npr, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KEYS: RangeKey[] = ["week", "month", "last-month", "3-months", "year", "custom"];

/**
 * Running cost: what it really takes to keep the shop going. Day sales and
 * other trading income against running costs — one-off setup buys and
 * owners'/lenders' money left out (a category's switch in Settings, or an
 * entry's own "One-off" mark here).
 */
export default async function RunningCostPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAuth();
  const range = resolveRange(await searchParams, "month");
  const today = nepalToday();
  const [categories, entries] = await Promise.all([getCategories(), getEntries(range.from, range.to)]);
  const rc = runningCost(entries, categories, range.from, range.to, today);
  const operatingCats = new Map(categories.map((c) => [c.id, c.is_operating]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const rq = rangeQuery(range);

  // Where a day's sales go: the trading-income category called "…sales", else the first one.
  const incomeCats = categories.filter((c) => c.kind === "in" && c.is_active && c.is_operating);
  const salesCat = incomeCats.find((c) => /day\s*sales/i.test(c.name)) ?? incomeCats.find((c) => /sale/i.test(c.name)) ?? incomeCats[0];

  const { unit, buckets } = byPeriod(rc.running, range.from, range.to);
  const biggestOut = entries.filter((e) => e.kind === "out").sort((a, b) => b.amount - a.amount).slice(0, 15);
  const leftOut = rc.left.sort((a, b) => b.amount - a.amount);

  const gap = rc.incomePerDay - rc.costPerDay;
  const tiles = [
    { label: "Trading income", value: npr(rc.income), sub: `${npr(Math.round(rc.incomePerDay))} a day`, dot: SERIES.in },
    { label: "Running cost", value: npr(rc.cost), sub: `${npr(Math.round(rc.costPerDay))} a day`, dot: SERIES.out },
    {
      label: "Left after running costs", value: `${rc.profit < 0 ? "−" : "+"}${npr(Math.abs(rc.profit))}`,
      // A margin under −100% says nothing useful — say how many times income the costs are instead.
      sub: rc.margin == null ? "no trading income yet"
        : rc.margin < -1 ? `costs are ${(rc.cost / rc.income).toFixed(1)}× the income` : `${Math.round(rc.margin * 100)}% of income`,
      tone: rc.profit < 0 ? "text-brand-red" : "text-green-700",
    },
    { label: "Sales needed a day", value: npr(Math.round(rc.costPerDay)), sub: "to cover the running cost" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-brown">Running cost</h1>
          <p className="text-sm text-stone-500">{prettyDate(range.from)} – {prettyDate(range.to)} · {rc.days} {rc.days === 1 ? "day" : "days"}</p>
        </div>
        <ReportTabs current="running" />
      </div>

      <div className="print:hidden"><RangePicker current={range.key} from={range.from} to={range.to} keys={KEYS} /></div>

      <p className="max-w-3xl text-sm leading-relaxed text-stone-600">
        What it really costs to keep the shop going: <b>day sales and other trading income</b> against <b>running costs</b> —
        ingredients, gas, salaries, rent, bills. One-off setup buys (counter, fridge, iPad…) and owners&apos; or lenders&apos; money
        are left out. A category&apos;s switch is in <Link href="/settings" className="font-bold text-brand-orange">Settings</Link>;
        a single entry can be marked <b>One-off</b> below.
      </p>

      {salesCat && (
        <section className="card p-5">
          <h2 className="font-bold text-brand-brown">Add a day&apos;s sales</h2>
          <p className="mb-3 text-xs text-stone-500">Saved as money in, under &ldquo;{salesCat.name}&rdquo;.</p>
          <DaySalesForm categoryId={salesCat.id} categoryName={salesCat.name} today={today} />
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold text-stone-500">
              {s.dot && <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.dot }} />}{s.label}
            </p>
            <p className={cn("mt-1 font-display text-xl font-bold sm:text-2xl", s.tone ?? "text-stone-900")}>{s.value}</p>
            <p className="text-xs text-stone-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {rc.days > 0 && (rc.cost > 0 || rc.income > 0) && (
        <section className={cn("card border-l-4 p-5", gap >= 0 ? "border-l-green-500" : "border-l-brand-red")}>
          <p className="font-display text-lg font-bold text-stone-900">
            Each day costs about {npr(Math.round(rc.costPerDay))} to run.{" "}
            {rc.income > 0 && (gap >= 0
              ? <>You take {npr(Math.round(rc.incomePerDay))} a day — <span className="text-green-700">{npr(Math.round(gap))} more than it costs.</span></>
              : <>You take {npr(Math.round(rc.incomePerDay))} a day — <span className="text-brand-red">{npr(Math.round(-gap))} short.</span></>)}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            At this rate a month of running costs is about {npr(Math.round(rc.costPerDay * 30))}
            {rc.income > 0 && <> and a month of trading income about {npr(Math.round(rc.incomePerDay * 30))}</>}.
          </p>
        </section>
      )}

      <section className="card p-4 sm:p-5">
        <h2 className="mb-3 font-bold text-brand-brown">Trading income and running cost by {unit}</h2>
        <InOutColumns data={buckets.map((b) => ({ label: b.label, in: b.in, out: b.out }))} height={240}
          labels={{ in: "Trading income", out: "Running cost" }} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-brand-brown">Running cost by category</h2>
          <BarList color={SERIES.out} max={10} empty="No running costs in this period."
            rows={byCategory(rc.running, categories, "out").map((c) => ({ ...c, href: `/entries?${rq}&kind=out&cat=${c.id}` }))} />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-brand-brown">Trading income by category</h2>
          <BarList color={SERIES.in} max={10} empty="No trading income in this period."
            rows={byCategory(rc.running, categories, "in").map((c) => ({ ...c, href: `/entries?${rq}&kind=in&cat=${c.id}` }))} />
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="p-5 pb-2">
          <h2 className="font-bold text-brand-brown">Biggest money out — running cost or one-off?</h2>
          <p className="text-xs text-stone-500">Mark setup buys (furniture, fridge, signboard…) as One-off so they don&apos;t count as a daily cost.</p>
        </div>
        <ul className="divide-y divide-stone-100">
          {biggestOut.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-stone-800">{e.description || catName.get(e.category_id) || "—"}</p>
                <p className="text-xs text-stone-400">{shortDate(e.occurred_on)} · {catName.get(e.category_id) ?? "—"}</p>
              </div>
              <span className="font-bold tabular-nums text-stone-900">{npr(e.amount)}</span>
              <RunningToggle id={e.id} kind="out" counted={isOperating(e, operatingCats)} />
            </li>
          ))}
          {biggestOut.length === 0 && <li className="px-5 py-8 text-center text-sm text-stone-400">No money out in this period.</li>}
        </ul>
      </section>

      <section className="card overflow-hidden">
        <div className="p-5 pb-2">
          <h2 className="font-bold text-brand-brown">Left out of the running cost</h2>
          <p className="text-xs text-stone-500">
            {npr(rc.leftOut)} out (one-offs, owners&apos; money) · {npr(rc.leftIn)} in (owners&apos; and lenders&apos; money).
            Still in your balance — just not a daily cost or income.
          </p>
        </div>
        <ul className="divide-y divide-stone-100">
          {leftOut.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SERIES[e.kind] }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-stone-800">{e.description || catName.get(e.category_id) || "—"}</p>
                <p className="text-xs text-stone-400">{shortDate(e.occurred_on)} · {catName.get(e.category_id) ?? "—"}</p>
              </div>
              <span className="font-bold tabular-nums text-stone-900">{npr(e.amount)}</span>
              <RunningToggle id={e.id} kind={e.kind} counted={false} />
            </li>
          ))}
          {leftOut.length === 0 && <li className="px-5 py-8 text-center text-sm text-stone-400">Nothing left out — every entry counts.</li>}
        </ul>
      </section>
    </div>
  );
}
