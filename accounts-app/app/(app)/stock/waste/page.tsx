import { requireAuth } from "@/lib/supabase/server";
import { resolveRange, prettyDate, nepalToday, type RangeKey } from "@/lib/dates";
import { getLosses, getLossStockItems } from "@/lib/losses";
import { LOSS_KINDS } from "@/lib/loss-kinds";
import { SERIES } from "@/lib/ledger";
import RangePicker from "@/components/range-picker";
import BarList from "@/components/bar-list";
import LossForm from "@/components/loss-form";
import LossList from "@/components/loss-list";
import { StockTabs } from "@/components/stock-tabs";
import { npr } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KEYS: RangeKey[] = ["today", "week", "month", "last-month", "3-months", "custom"];

/**
 * Waste & loss (migration 052): food wasted, things broken, missing or any
 * other loss — with what it was worth. Stock waste written elsewhere (Stock
 * page, approved POS waste) is listed too. Not part of the money book.
 */
export default async function WastePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAuth();
  const sp = await searchParams;
  const range = resolveRange(sp, "month");
  const [l, items] = await Promise.all([getLosses(range.from, range.to), getLossStockItems()]);
  const share = (rows: { name: string; value: number }[]) => rows.map((x) => ({ id: x.name, name: x.name, amount: x.value, share: l.total ? x.value / l.total : 0 }));
  const h2 = "font-display text-lg font-bold text-brand-brown";

  return (
    <div className="space-y-5">
      <StockTabs current="waste" />
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-brown">Waste &amp; loss</h1>
        <p className="text-sm text-stone-500">Food wasted, things broken, missing or lost — and what it cost. Not part of the money book.</p>
      </div>
      <LossForm items={items} today={nepalToday()} startOpen={sp.add === "1"} />

      <div className="space-y-3">
        <RangePicker current={range.key} from={range.from} to={range.to} keys={KEYS} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="card col-span-2 p-4 sm:col-span-1">
            <p className="text-xs font-bold text-stone-500">Lost · {range.from === range.to ? prettyDate(range.from) : range.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-brand-red">{npr(l.total)}</p>
            <p className="text-xs text-stone-400">{l.rows.length} {l.rows.length === 1 ? "entry" : "entries"}{l.unvalued ? ` · ${l.unvalued} with no worth` : ""}</p>
          </div>
          {l.byKind.map((k) => (
            <div key={k.kind} className="card p-4">
              <p className="text-xs font-bold text-stone-500">{LOSS_KINDS[k.kind].label}</p>
              <p className="mt-1 font-display text-xl font-bold text-stone-900">{npr(k.value)}</p>
              <p className="text-xs text-stone-400">{k.count} {k.count === 1 ? "entry" : "entries"}</p>
            </div>
          ))}
        </div>
      </div>

      {l.rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-bold text-brand-brown">Nothing lost in this period</p>
          <p className="mt-1 text-sm text-stone-500">When food is wasted or something breaks, write it down here — it shows where money leaks.</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <section className="space-y-2">
            <h2 className={h2}>Every loss</h2>
            <LossList rows={l.rows} />
          </section>
          <section className="space-y-2">
            <h2 className={h2}>Lost the most</h2>
            <div className="card p-4"><BarList rows={share(l.byWhat)} color={SERIES.out} empty="No worth written yet." /></div>
            {l.unvalued > 0 && (
              <p className="text-xs text-stone-500">Some stock waste has no worth — set the item&apos;s &ldquo;Cost of one&rdquo; (Stock → Edit) and it&apos;s counted.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
