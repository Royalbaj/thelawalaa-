import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Paperclip, Lightbulb, AlertTriangle } from "lucide-react";
import { getLowStock } from "@/lib/stock";
import { requireAuth } from "@/lib/supabase/server";
import { nepalToday, startOfWeek, startOfMonth, resolveRange, rangeQuery, longDate, dayCount, type RangeKey } from "@/lib/dates";
import { getCategories, getEntries, getBalance, totals, within, byCategory, byPeriod, SERIES } from "@/lib/ledger";
import { InOutColumns } from "@/components/charts";
import BarList from "@/components/bar-list";
import RangePicker from "@/components/range-picker";
import EntryRow from "@/components/entry-row";
import { npr, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KEYS: RangeKey[] = ["today", "week", "month", "last-month", "3-months", "year", "custom"];

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${npr(Math.abs(n))}`;
const Dot = ({ color }: { color: string }) => <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />;

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { person } = await requireAuth();
  const sp = await searchParams;
  const today = nepalToday();
  const weekFrom = startOfWeek(today);
  const monthFrom = startOfMonth(today);
  const range = resolveRange(sp, "month");
  const fetchFrom = [range.from, weekFrom, monthFrom].sort()[0];
  const fetchTo = range.to > today ? range.to : today;

  const [categories, entries, bal, lowStock] = await Promise.all([
    getCategories(), getEntries(fetchFrom, fetchTo), getBalance(), getLowStock().catch(() => []),
  ]);
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  const periods = [
    { label: "Today", q: "range=today", ...totals(within(entries, today, today)) },
    { label: "This week", q: "range=week", ...totals(within(entries, weekFrom, today)) },
    { label: "This month", q: "range=month", ...totals(within(entries, monthFrom, today)) },
  ];

  const inRange = within(entries, range.from, range.to);
  const t = totals(inRange);
  const { unit, buckets } = byPeriod(inRange, range.from, range.to);
  const outCats = byCategory(inRange, categories, "out");
  const inCats = byCategory(inRange, categories, "in");
  const missingBills = inRange.filter((e) => e.kind === "out" && !e.bill_path).length;
  const days = dayCount(range.from, range.to > today ? today : range.to);
  const rq = rangeQuery(range);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-brown">Hi {person.name.split(" ")[0]}</h1>
          <p className="text-sm text-stone-500">{longDate(today)}</p>
        </div>
        <div className="hidden gap-2 md:flex">
          <Link href="/entries/new?kind=in" className="btn-outline !px-4 !py-2.5 text-sm"><ArrowDownLeft size={16} style={{ color: SERIES.in }} /> Money in</Link>
          <Link href="/entries/new?kind=out" className="btn-primary !px-4 !py-2.5 text-sm"><ArrowUpRight size={16} /> Money out</Link>
        </div>
      </div>

      {lowStock.length > 0 && (
        <Link href="/stock" className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 transition hover:bg-amber-100/60">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />
          <span className="min-w-0 text-sm text-amber-900">
            <b>Running low:</b>{" "}
            {lowStock.map((s) => `${s.name} (${s.remaining <= 0 ? "out" : `${+s.remaining.toFixed(2)} ${s.unit} left`})`).join(" · ")}
          </span>
          <span className="ml-auto shrink-0 text-sm font-bold text-amber-800">Stock →</span>
        </Link>
      )}

      {/* The one number this screen leads with. */}
      <section className="card p-5 sm:p-6">
        <p className="text-sm font-bold text-stone-500">Balance left</p>
        <p className={cn("mt-1 font-display text-5xl font-bold tracking-tight", bal.balance < 0 ? "text-brand-red" : "text-stone-900")}>{npr(bal.balance)}</p>
        <p className="mt-2 text-xs text-stone-500">
          Starting money {npr(bal.opening)} + all money in {npr(bal.totalIn)} − all money out {npr(bal.totalOut)}
          {" · "}<Link href="/settings" className="font-bold text-brand-orange">Set starting money</Link>
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {periods.map((p) => (
          <Link key={p.label} href={`/entries?${p.q}`} className="card block p-4 transition hover:shadow-md">
            <p className="flex items-baseline justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-400">{p.label}</span>
              <span className="text-xs text-stone-400">{p.count} {p.count === 1 ? "entry" : "entries"}</span>
            </p>
            <p className={cn("mt-1 font-display text-2xl font-bold", p.net < 0 ? "text-brand-red" : p.net > 0 ? "text-green-700" : "text-stone-900")}>{signed(p.net)}</p>
            <div className="mt-2 space-y-1 text-sm">
              <p className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-stone-600"><Dot color={SERIES.in} /> In</span><b className="tabular-nums">{npr(p.moneyIn)}</b></p>
              <p className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-stone-600"><Dot color={SERIES.out} /> Out</span><b className="tabular-nums">{npr(p.moneyOut)}</b></p>
            </div>
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-brand-brown">Money in and out — {range.label}</h2>
        <RangePicker current={range.key} from={range.from} to={range.to} keys={KEYS} />
        <div className="card p-4 sm:p-5">
          <div className="mb-3 grid grid-cols-3 gap-2 text-center sm:text-left">
            <div><p className="text-xs font-bold text-stone-400">Money in</p><p className="font-bold tabular-nums">{npr(t.moneyIn)}</p></div>
            <div><p className="text-xs font-bold text-stone-400">Money out</p><p className="font-bold tabular-nums">{npr(t.moneyOut)}</p></div>
            <div><p className="text-xs font-bold text-stone-400">Net</p><p className={cn("font-bold tabular-nums", t.net < 0 ? "text-brand-red" : "text-green-700")}>{signed(t.net)}</p></div>
          </div>
          <InOutColumns data={buckets.map((b) => ({ label: b.label, in: b.in, out: b.out }))} />
          <p className="mt-1 text-[11px] text-stone-400">One pair of bars per {unit}.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <h3 className="mb-3 font-bold text-brand-brown">Where the money went</h3>
            <BarList color={SERIES.out} empty="No money out in this period."
              rows={outCats.map((c) => ({ ...c, href: `/entries?${rq}&kind=out&cat=${c.id}` }))} />
          </div>
          <div className="card p-5">
            <h3 className="mb-3 font-bold text-brand-brown">Where the money came from</h3>
            <BarList color={SERIES.in} empty="No money in for this period — add the day's sales with “+ Money in”."
              rows={inCats.map((c) => ({ ...c, href: `/entries?${rq}&kind=in&cat=${c.id}` }))} />
          </div>
        </div>

        {(t.count > 0) && (
          <div className="card space-y-2 p-4 text-sm">
            <p className="flex items-center gap-1.5 font-bold text-brand-brown"><Lightbulb size={16} /> Worth knowing</p>
            {outCats[0] && <p className="text-stone-600">Biggest spend: <b>{outCats[0].name}</b> — {npr(outCats[0].amount)} ({Math.round(outCats[0].share * 100)}% of money out).</p>}
            {t.moneyIn > 0 && days > 1 && <p className="text-stone-600">Money in averages <b>{npr(t.moneyIn / days)}</b> a day over {days} days.</p>}
            {missingBills > 0 && (
              <p className="text-amber-800">
                <Paperclip size={13} className="mr-1 inline" />
                {missingBills} money-out {missingBills === 1 ? "entry has" : "entries have"} no bill attached.{" "}
                <Link href={`/entries?${rq}&kind=out&nobill=1`} className="font-bold underline">Add bills</Link>
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-brand-brown">Latest entries</h2>
          <Link href={`/entries?${rq}`} className="text-sm font-bold text-brand-orange">See all →</Link>
        </div>
        <div className="card divide-y divide-stone-100 overflow-hidden">
          {inRange.slice(0, 8).map((e) => <EntryRow key={e.id} e={e} category={catName.get(e.category_id) ?? "—"} showDate />)}
          {inRange.length === 0 && <p className="px-4 py-8 text-center text-sm text-stone-400">No entries in this period yet.</p>}
        </div>
      </section>
    </div>
  );
}
