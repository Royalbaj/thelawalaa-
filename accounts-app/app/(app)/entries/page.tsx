import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, FileSpreadsheet, FileText } from "lucide-react";
import { requireAuth } from "@/lib/supabase/server";
import { resolveRange, rangeQuery, longDate, type RangeKey } from "@/lib/dates";
import { getCategories, getEntries, getPeople, totals, SERIES, type Entry, type Kind } from "@/lib/ledger";
import RangePicker from "@/components/range-picker";
import EntryFilters from "@/components/entry-filters";
import EntryRow from "@/components/entry-row";
import { npr, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KEYS: RangeKey[] = ["today", "week", "month", "last-month", "3-months", "year", "custom"];
const LIMIT = 2000;

export default async function EntriesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAuth();
  const sp = await searchParams;
  const range = resolveRange(sp, "month");
  const kind = sp.kind === "in" || sp.kind === "out" ? (sp.kind as Kind) : undefined;
  const cat = /^[0-9a-f-]{36}$/.test(sp.cat ?? "") ? sp.cat : undefined;
  const q = (sp.q ?? "").trim().slice(0, 60) || undefined;
  const nobill = sp.nobill === "1" ? "1" : undefined;
  const by = /^[0-9a-f-]{36}$/.test(sp.by ?? "") ? sp.by : undefined;

  const [categories, people, entries] = await Promise.all([
    getCategories(),
    getPeople(),
    getEntries(range.from, range.to, { kind, categoryId: cat, q, missingBill: !!nobill, personId: by }, LIMIT),
  ]);
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const t = totals(entries);
  const days = new Map<string, Entry[]>();
  for (const e of entries) days.set(e.occurred_on, [...(days.get(e.occurred_on) ?? []), e]);

  const filters = { kind, cat, q, nobill, by };
  const exportQuery = new URLSearchParams(rangeQuery(range));
  Object.entries({ kind, cat, q, nobill, by }).forEach(([k, v]) => { if (v) exportQuery.set(k, v); });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-brand-brown">Entries</h1>
        <div className="flex gap-2">
          <Link href="/entries/new?kind=in" className="btn-outline !px-4 !py-2 text-sm"><ArrowDownLeft size={16} style={{ color: SERIES.in }} /> In</Link>
          <Link href="/entries/new?kind=out" className="btn-primary !px-4 !py-2 text-sm"><ArrowUpRight size={16} /> Out</Link>
        </div>
      </div>

      <RangePicker current={range.key} from={range.from} to={range.to} keys={KEYS} keep={filters} />
      <EntryFilters params={{ ...filters, ...Object.fromEntries(new URLSearchParams(rangeQuery(range))) }} categories={categories} people={people} />

      <div className="card grid grid-cols-3 gap-2 p-4 text-center sm:text-left">
        <div><p className="text-xs font-bold text-stone-400">Money in</p><p className="font-bold tabular-nums">{npr(t.moneyIn)}</p></div>
        <div><p className="text-xs font-bold text-stone-400">Money out</p><p className="font-bold tabular-nums">{npr(t.moneyOut)}</p></div>
        <div><p className="text-xs font-bold text-stone-400">Net · {t.count} entries</p>
          <p className={cn("font-bold tabular-nums", t.net < 0 ? "text-brand-red" : "text-green-700")}>{t.net < 0 ? "−" : "+"}{npr(Math.abs(t.net))}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-bold text-stone-500">Download this list:</span>
        <a href={`/export?${exportQuery}&format=xlsx`} className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 font-bold text-green-800 ring-1 ring-stone-200 hover:bg-green-50">
          <FileSpreadsheet size={15} /> Excel
        </a>
        <a href={`/export?${exportQuery}&format=csv`} className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 font-bold text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50">
          <FileText size={15} /> CSV
        </a>
      </div>

      {[...days.entries()].map(([day, list]) => {
        const d = totals(list);
        return (
          <section key={day}>
            <div className="mb-1 flex items-baseline justify-between px-1 text-xs font-bold text-stone-500">
              <span>{longDate(day)}</span>
              <span className="tabular-nums">
                {d.moneyIn > 0 && <span className="text-green-700">+{npr(d.moneyIn)}</span>}
                {d.moneyIn > 0 && d.moneyOut > 0 && " · "}
                {d.moneyOut > 0 && <span>−{npr(d.moneyOut)}</span>}
              </span>
            </div>
            <div className="card divide-y divide-stone-100 overflow-hidden">
              {list.map((e) => <EntryRow key={e.id} e={e} category={catName.get(e.category_id) ?? "—"} />)}
            </div>
          </section>
        );
      })}
      {entries.length === 0 && (
        <div className="card px-4 py-10 text-center text-sm text-stone-400">
          Nothing matches. Try another period or clear the filters.
        </div>
      )}
      {entries.length >= LIMIT && <p className="text-center text-xs text-stone-400">Showing the latest {LIMIT} — download Excel for everything.</p>}
    </div>
  );
}
