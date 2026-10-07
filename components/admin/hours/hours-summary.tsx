import Link from "next/link";
import { hoursLabel, type getHoursSummary } from "@/lib/time-clock";
import { cn } from "@/lib/utils";

type Summary = Awaited<ReturnType<typeof getHoursSummary>>;
const PERIODS = [["today", "Today"], ["week", "This week"], ["month", "This month"], ["all", "All time"]] as const;

/** Total hours per staff member: today, this week, this month, all time (Admin dashboard + Staff Hours). */
export default function HoursSummary({ s, link }: { s: Summary; link?: boolean }) {
  return (
    <section className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-brand-brown">Total hours worked</h2>
        {link ? (
          <Link href="/admin/hours" className="text-sm font-bold text-brand-orange hover:underline">Shifts &amp; edits →</Link>
        ) : (
          <p className="text-xs text-stone-400">Nepal days · weeks start on Sunday · only you see this</p>
        )}
      </div>
      {s.rows.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">Nobody has clocked in yet. Staff clock in and out with the Clock button on the POS.</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {s.rows.map((r) => (
            <div key={r.key} className="rounded-xl bg-stone-50 p-3.5">
              <p className="flex items-center gap-2 font-bold">
                <span className="truncate">{r.name}</span>
                {r.on && <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-green-800">On now</span>}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                {PERIODS.map(([k, label]) => (
                  <div key={k}>
                    <dt className="text-[11px] font-bold uppercase tracking-wide text-stone-400">{label}</dt>
                    <dd className={cn("font-display font-bold tabular-nums", k === "month" ? "text-lg text-brand-brown" : "text-stone-800")}>{hoursLabel(r[k])}</dd>
                  </div>
                ))}
              </dl>
              {r.missed > 0 && <p className="mt-1.5 text-xs font-bold text-amber-700">{r.missed} shift{r.missed === 1 ? "" : "s"} without a clock-out (not counted)</p>}
            </div>
          ))}
        </div>
      )}
      {s.rows.length > 1 && (
        <p className="mt-3 text-sm text-stone-500">
          Everyone: today <b className="tabular-nums text-stone-800">{hoursLabel(s.total.today)}</b> · this week <b className="tabular-nums text-stone-800">{hoursLabel(s.total.week)}</b> · this month <b className="tabular-nums text-stone-800">{hoursLabel(s.total.month)}</b>
        </p>
      )}
    </section>
  );
}
