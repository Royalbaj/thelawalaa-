import { FileSpreadsheet } from "lucide-react";
import { rangeQuery, prettyDate, type Range, type RangeKey } from "@/lib/dates";
import type { SalesReport } from "@/lib/sales-report";
import { Columns, SERIES_1, SERIES_2 } from "@/components/admin/sales-charts";
import BarList from "@/components/admin/bar-list";
import RangePicker from "@/components/admin/range-picker";
import { npr, cn } from "@/lib/utils";

const KEYS: RangeKey[] = ["today", "week", "month", "last-month", "3-months", "year", "custom"];

/** The whole Admin → Reports screen, for a period's already-loaded report. */
export default function SalesReportView({ range, r }: { range: Range; r: SalesReport }) {
  const k = r.kpis;

  const tiles = [
    { label: "Sales (paid)", value: npr(k.sales), sub: `${k.paidOrders} paid orders` },
    { label: "Orders", value: String(k.orders), sub: `${k.itemsSold} items sold` },
    { label: "Average order", value: npr(Math.round(k.avgOrder)), sub: "paid orders" },
    { label: "Discounts given", value: npr(k.discounts), sub: "student, member, promo" },
    { label: "To collect", value: npr(k.toCollect), sub: "unpaid, not cancelled", warn: k.toCollect > 0 },
    { label: "Cancelled", value: String(k.cancelled), sub: "orders" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-brand-brown">Sales report</h1>
          <p className="text-sm text-stone-500">{prettyDate(range.from)} – {prettyDate(range.to)} · Nepal time · from POS and website orders</p>
        </div>
        <a href={`/admin/reports/excel?${rangeQuery(range)}`}
          className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-green-800 ring-1 ring-stone-200 hover:bg-green-50">
          <FileSpreadsheet size={15} /> Download Excel
        </a>
      </div>

      <RangePicker current={range.key} from={range.from} to={range.to} keys={KEYS} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className={cn("card p-4", t.warn && "ring-2 ring-amber-200")}>
            <p className="text-xs font-bold text-stone-500">{t.label}</p>
            <p className="mt-1 font-display text-xl font-bold text-stone-900">{t.value}</p>
            <p className="text-xs text-stone-400">{t.sub}</p>
          </div>
        ))}
      </div>

      <section className="card p-4 sm:p-5">
        <h2 className="mb-3 font-bold text-brand-brown">Sales by {r.unit} — counter vs online</h2>
        <Columns
          data={r.periods.map((p) => ({ label: p.label, counter: p.counter, online: p.online }))}
          series={[{ key: "counter", label: "Counter (POS)", color: SERIES_1 }, { key: "online", label: "Online", color: SERIES_2 }]}
        />
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="font-bold text-brand-brown">Busiest hours</h2>
        <p className="mb-3 text-xs text-stone-500">Orders placed in each hour of the day, over the whole period.</p>
        <Columns data={r.hours} series={[{ key: "count", label: "Orders", color: SERIES_1 }]} money={false} height={200}
          empty="No orders in this period yet." tableLabel="Hour" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-brand-brown">Top products</h2>
          {r.topProducts.length ? (
            <table className="w-full text-sm tabular-nums">
              <thead><tr className="text-left text-xs text-stone-400"><th className="pb-2">#</th><th className="pb-2">Product</th><th className="pb-2 text-right">Sold</th><th className="pb-2 text-right">Sales</th></tr></thead>
              <tbody>
                {r.topProducts.slice(0, 10).map((p, i) => (
                  <tr key={p.id} className="border-t border-stone-100">
                    <td className="py-2 text-stone-400">{i + 1}</td>
                    <td className="py-2 font-bold text-stone-800">{p.name}</td>
                    <td className="py-2 text-right">{p.count}</td>
                    <td className="py-2 text-right font-bold">{npr(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="py-6 text-center text-sm text-stone-400">No sales in this period yet.</p>}
          <p className="mt-2 text-[11px] text-stone-400">Before discounts; cancelled orders left out.</p>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-brand-brown">Sales by category</h2>
          <BarList color={SERIES_1} rows={r.byCategory} empty="No sales in this period yet." />
          <p className="mt-2 text-[11px] text-stone-400">Before discounts.</p>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-brand-brown">How customers paid</h2>
          <BarList color={SERIES_1} rows={r.byMethod} empty="No paid orders in this period yet." />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold text-brand-brown">Dine-in, pickup or delivery</h2>
          <BarList color={SERIES_1} rows={r.byType} empty="No paid orders in this period yet." />
        </section>
      </div>
    </div>
  );
}
