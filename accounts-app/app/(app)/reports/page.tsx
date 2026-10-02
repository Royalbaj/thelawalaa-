import { FileSpreadsheet, FileText } from "lucide-react";
import { requireAuth } from "@/lib/supabase/server";
import { resolveRange, rangeQuery, prettyDate, dayCount, nepalToday, type RangeKey } from "@/lib/dates";
import { getCategories, getEntries, getBalance, totals, byCategory, byMethod, byPeriod, runningBalance, SERIES, KIND_LABELS, type Kind } from "@/lib/ledger";
import { InOutColumns, BalanceArea } from "@/components/charts";
import BarList from "@/components/bar-list";
import RangePicker from "@/components/range-picker";
import PrintButton from "@/components/print-button";
import { npr, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KEYS: RangeKey[] = ["week", "month", "last-month", "3-months", "year", "custom"];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAuth();
  const range = resolveRange(await searchParams, "month");
  const [categories, entries, before] = await Promise.all([getCategories(), getEntries(range.from, range.to), getBalance(range.from)]);

  const t = totals(entries);
  const today = nepalToday();
  const days = dayCount(range.from, range.to > today ? today : range.to);
  const { unit, buckets } = byPeriod(entries, range.from, range.to);
  const balance = runningBalance(before.balance, buckets);
  const closing = before.balance + t.net;
  const rq = rangeQuery(range);
  const cats = (["out", "in"] as Kind[]).flatMap((k) => byCategory(entries, categories, k).map((s) => ({
    ...s, kind: k, count: entries.filter((e) => e.kind === k && e.category_id === s.id).length,
  })));

  const tiles = [
    { label: "Money in", value: npr(t.moneyIn), sub: `${npr(t.moneyIn / Math.max(days, 1))} a day`, dot: SERIES.in },
    { label: "Money out", value: npr(t.moneyOut), sub: `${npr(t.moneyOut / Math.max(days, 1))} a day`, dot: SERIES.out },
    { label: "Net (in − out)", value: `${t.net < 0 ? "−" : "+"}${npr(Math.abs(t.net))}`, sub: `${t.count} entries`, tone: t.net < 0 ? "text-brand-red" : "text-green-700" },
    { label: "Balance at the end", value: npr(closing), sub: `Started at ${npr(before.balance)}`, tone: closing < 0 ? "text-brand-red" : undefined },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-brown">Reports</h1>
          <p className="text-sm text-stone-500">{prettyDate(range.from)} – {prettyDate(range.to)}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm print:hidden">
          <a href={`/export?${rq}&format=xlsx`} className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 font-bold text-green-800 ring-1 ring-stone-200 hover:bg-green-50"><FileSpreadsheet size={15} /> Excel</a>
          <a href={`/export?${rq}&format=csv`} className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 font-bold text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"><FileText size={15} /> CSV</a>
          <PrintButton />
        </div>
      </div>

      <div className="print:hidden"><RangePicker current={range.key} from={range.from} to={range.to} keys={KEYS} /></div>

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

      <section className="card p-4 sm:p-5">
        <h2 className="mb-3 font-bold text-brand-brown">Money in and out by {unit}</h2>
        <InOutColumns data={buckets.map((b) => ({ label: b.label, in: b.in, out: b.out }))} height={260} />
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="font-bold text-brand-brown">Balance over time</h2>
        <p className="mb-3 text-xs text-stone-500">Money left at the end of each {unit}, counting the starting money and everything entered before.</p>
        <BalanceArea data={balance} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-brand-brown">Money out by category</h2>
          <BarList color={SERIES.out} max={10} empty="No money out in this period."
            rows={byCategory(entries, categories, "out").map((c) => ({ ...c, href: `/entries?${rq}&kind=out&cat=${c.id}` }))} />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-brand-brown">Money in by category</h2>
          <BarList color={SERIES.in} max={10} empty="No money in for this period."
            rows={byCategory(entries, categories, "in").map((c) => ({ ...c, href: `/entries?${rq}&kind=in&cat=${c.id}` }))} />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-brand-brown">Money in — cash, bank or QR</h2>
          <BarList color={SERIES.in} rows={byMethod(entries, "in")} empty="No money in for this period." />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-brand-brown">Money out — cash, bank or QR</h2>
          <BarList color={SERIES.out} rows={byMethod(entries, "out")} empty="No money out in this period." />
        </section>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="px-5 pt-5 font-bold text-brand-brown">All categories</h2>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-left text-xs text-stone-400">
              <th className="px-5 py-2">Category</th><th className="py-2">Type</th>
              <th className="py-2 text-right">Entries</th><th className="py-2 text-right">Share</th><th className="px-5 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {cats.map((c) => (
              <tr key={`${c.kind}-${c.id}`} className="border-b border-stone-50 last:border-0">
                <td className="px-5 py-2 font-bold text-stone-800">{c.name}</td>
                <td className="py-2 text-stone-500"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: SERIES[c.kind] }} />{KIND_LABELS[c.kind]}</td>
                <td className="py-2 text-right text-stone-500">{c.count}</td>
                <td className="py-2 text-right text-stone-500">{Math.round(c.share * 100)}%</td>
                <td className="px-5 py-2 text-right font-bold">{npr(c.amount)}</td>
              </tr>
            ))}
            {cats.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-stone-400">Nothing entered for this period.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
