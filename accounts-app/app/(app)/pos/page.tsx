import { requireAuth } from "@/lib/supabase/server";
import { resolveRange, prettyDate, shortDate, type RangeKey } from "@/lib/dates";
import { getPosReport } from "@/lib/pos";
import { METHOD_LABELS, PAID_WITH, npDayTime, npTime } from "@/lib/pos-outlet";
import RangePicker from "@/components/range-picker";
import BarList from "@/components/bar-list";
import { RequestCard, IssueCard, requestText } from "@/components/pos-report";
import { SERIES } from "@/lib/ledger";
import { npr, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const KEYS: RangeKey[] = ["today", "week", "month", "last-month", "custom"];

/**
 * POS (migration 051): everything the counter recorded — kept apart from the
 * money book (nothing here is added to it). Changes the counter asked for wait
 * at the top; then sales and cash counts from the POS, the outlet's day
 * expenses, issues & notes and stock added on the POS.
 */
export default async function PosPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAuth();
  const range = resolveRange(await searchParams, "today");
  const r = await getPosReport(range.from, range.to);
  const open = r.issues.filter((i) => !i.resolvedAt).sort((a, b) => Number(b.urgent) - Number(a.urgent));
  const sorted = r.issues.filter((i) => i.resolvedAt);
  const share = (rows: { name: string; amount: number }[]) => rows.map((x) => ({ id: x.name, name: x.name, amount: x.amount, share: r.expenseTotal ? x.amount / r.expenseTotal : 0 }));
  const oneDay = range.from === range.to;

  const tiles = [
    { label: "POS sales (paid)", value: npr(r.sales.total), sub: `${r.sales.orders} orders · counter ${npr(r.sales.counter)} · online ${npr(r.sales.online)}` },
    { label: "Day expenses", value: npr(r.expenseTotal), sub: `${npr(r.tillCash)} from the till` },
    { label: "Open issues", value: String(open.length), sub: open.some((i) => i.urgent) ? `${open.filter((i) => i.urgent).length} urgent` : "none urgent", warn: open.some((i) => i.urgent) },
    { label: "Waiting for approval", value: String(r.pending.length), sub: r.pending.length ? "see below" : "nothing waiting", warn: r.pending.length > 0 },
  ];
  const section = "space-y-3";
  const h2 = "font-display text-lg font-bold text-brand-brown";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-brown">POS</h1>
        <p className="text-sm text-stone-500">
          {oneDay ? prettyDate(range.from) : `${prettyDate(range.from)} – ${prettyDate(range.to)}`} · what the counter recorded — not part of the money book
        </p>
      </div>
      <RangePicker current={range.key} from={range.from} to={range.to} keys={KEYS} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className={cn("card p-4", t.warn && "ring-2 ring-amber-200")}>
            <p className="text-xs font-bold text-stone-500">{t.label}</p>
            <p className="mt-1 font-display text-xl font-bold text-stone-900">{t.value}</p>
            <p className="text-xs text-stone-400">{t.sub}</p>
          </div>
        ))}
      </div>

      {r.pending.length > 0 && (
        <section className={section}>
          <div>
            <h2 className={h2}>Waiting for approval ({r.pending.length})</h2>
            <p className="text-xs text-stone-500">The counter asked for these on the POS. Approving makes the change straight away, with your name on it.</p>
          </div>
          <ul className="grid gap-3 lg:grid-cols-2">{r.pending.map((x) => <RequestCard key={x.id} r={x} />)}</ul>
        </section>
      )}

      <section className={section}>
        <h2 className={h2}>Issues &amp; notes</h2>
        {open.length === 0 && sorted.length === 0 ? <p className="text-sm text-stone-500">Nothing noted.</p> : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {open.map((i) => <IssueCard key={i.id} i={i} />)}
            {sorted.map((i) => <IssueCard key={i.id} i={i} />)}
          </ul>
        )}
      </section>

      <section className={section}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={h2}>Day expenses</h2>
          <p className="text-xs text-stone-500">Total {npr(r.expenseTotal)} · from the till {npr(r.tillCash)} (taken off the shift&apos;s cash count)</p>
        </div>
        {r.expenses.length === 0 ? <p className="text-sm text-stone-500">No expenses written on the POS.</p> : (
          <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
            <ul className="card divide-y divide-stone-100">
              {r.expenses.map((e) => (
                <li key={e.id} className={cn("flex items-start justify-between gap-3 px-4 py-3", e.removed && "opacity-50")}>
                  <div className="min-w-0 text-sm">
                    <p className={cn("font-bold text-stone-800", e.removed && "line-through")}>{e.reason}</p>
                    <p className="text-xs text-stone-500">
                      {!oneDay && `${shortDate(e.occurredOn)} · `}{npTime(e.createdAt)} · {e.category} · {PAID_WITH[e.paidWith] ?? e.paidWith} · {e.personName}
                    </p>
                    {(e.removed || e.editedBy) && <p className="text-xs text-stone-400">{e.removed ? "Removed" : "Changed"} — approved by {e.editedBy}</p>}
                    {e.hasBill && <a href={`/pos-bills/${e.id}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-orange">See the bill</a>}
                  </div>
                  <p className={cn("shrink-0 font-display font-bold tabular-nums", e.removed && "line-through")}>{npr(e.amount)}</p>
                </li>
              ))}
            </ul>
            <div className="space-y-4">
              <div className="card p-4">
                <p className="mb-3 text-sm font-bold text-stone-700">By kind of cost</p>
                <BarList rows={share(r.byCategory)} color={SERIES.out} />
              </div>
              <div className="card p-4">
                <p className="mb-3 text-sm font-bold text-stone-700">By who wrote it</p>
                <BarList rows={share(r.byPerson)} color={SERIES.out} />
              </div>
            </div>
          </div>
        )}
      </section>

      <section className={section}>
        <h2 className={h2}>Sales &amp; cash counts</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <p className="mb-2 text-sm font-bold text-stone-700">Paid sales by method</p>
            {r.sales.byMethod.length === 0 ? <p className="text-sm text-stone-500">No paid sales.</p> : (
              <table className="w-full text-sm tabular-nums">
                <tbody>
                  {r.sales.byMethod.map((m) => (
                    <tr key={m.method} className="border-t border-stone-100 first:border-0">
                      <td className="py-1.5">{METHOD_LABELS[m.method] ?? m.method}</td>
                      <td className="py-1.5 text-right text-stone-500">{m.count}</td>
                      <td className="py-1.5 text-right font-bold">{npr(m.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-xs text-stone-500">
              Discounts {npr(r.sales.discounts)} · still to collect {npr(r.sales.unpaid)} · {r.sales.cancelled} cancelled
            </p>
          </div>
          <div className="card p-4">
            <p className="mb-2 text-sm font-bold text-stone-700">Shift cash counts</p>
            {r.closes.length === 0 ? <p className="text-sm text-stone-500">No shift closed in this period.</p> : (
              <ul className="divide-y divide-stone-100 text-sm">
                {r.closes.map((c) => (
                  <li key={c.at} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="font-bold">{npDayTime(c.at)}{c.countedBy ? ` · ${c.countedBy}` : ""}</p>
                      <p className="text-xs text-stone-500">
                        should be {npr(c.expected)} · counted {npr(c.counted)}{c.tillExpenses ? ` · ${npr(c.tillExpenses)} spent from the till` : ""}
                      </p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold",
                      Math.abs(c.difference) < 1 ? "bg-green-100 text-green-800" : c.difference < 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800")}>
                      {Math.abs(c.difference) < 1 ? "Balanced" : c.difference < 0 ? `Short ${npr(-c.difference)}` : `Over ${npr(c.difference)}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className={section}>
        <h2 className={h2}>Stock added on the POS</h2>
        {r.stockAdds.length === 0 ? <p className="text-sm text-stone-500">None in this period.</p> : (
          <ul className="card divide-y divide-stone-100 text-sm">
            {r.stockAdds.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span><b>+{a.quantity} {a.unit}</b> {a.item}{a.note ? <span className="text-stone-500"> — {a.note}</span> : null}</span>
                <span className="shrink-0 text-xs text-stone-500">{a.personName} · {npDayTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {r.decided.length > 0 && (
        <section className={section}>
          <h2 className={h2}>Decided in this period</h2>
          <ul className="card divide-y divide-stone-100 text-sm">
            {r.decided.map((x) => (
              <li key={x.id} className="px-4 py-2.5">
                <p><span className={cn("mr-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase", x.status === "approved" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700")}>
                  {x.status === "approved" ? "Approved" : "Not approved"}</span>{requestText(x)}</p>
                <p className="text-xs text-stone-500">
                  Asked by {x.personName} — &ldquo;{x.reason}&rdquo; · {x.decidedName} {x.decidedAt ? npDayTime(x.decidedAt) : ""}{x.decisionNote ? ` — ${x.decisionNote}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
