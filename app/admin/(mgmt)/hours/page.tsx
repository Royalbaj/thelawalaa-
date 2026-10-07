import { Download } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { nepalToday, prettyDate, rangeQuery, resolveRange, type RangeKey } from "@/lib/dates";
import { getStaffHours, hoursLabel, MAX_SHIFT_HOURS } from "@/lib/time-clock";
import RangePicker from "@/components/admin/range-picker";
import ShiftRow, { ClockOutNow } from "@/components/admin/hours/shift-row";
import AddShift from "@/components/admin/hours/add-shift";
import ClockPeople from "@/components/admin/hours/clock-people";

export const dynamic = "force-dynamic";

const KEYS: RangeKey[] = ["today", "week", "month", "last-month", "custom"];

// POS time clock (migration 036): counter staff clock in and out on the POS
// with their own PIN; only this page shows the hours.
export default async function StaffHoursPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole(["super_admin"]);
  const range = resolveRange(await searchParams, "month");
  const [h, { data: videos }] = await Promise.all([
    getStaffHours(range.from, range.to),
    supabaseAdmin.from("training_videos").select("id").eq("is_active", true),
  ]);
  const clockers = h.people.filter((p) => p.pos_clock);
  const today = nepalToday();
  const head = "px-4 py-2.5";

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-brand-brown">Staff Hours</h1>
          <p className="text-sm text-stone-500">Clock-ins from the POS. Only you see the hours; staff see their clock times only.</p>
        </div>
        <a href={`/admin/hours/export?${rangeQuery(range)}`}
          className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-green-800 ring-1 ring-stone-200 hover:bg-green-50">
          <Download size={15} /> Download CSV
        </a>
      </div>

      {clockers.length === 0 && (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          Nobody can clock in yet. Under <b>Who can clock in · PINs</b> below, switch on your counter staff (or add them with a PIN).
        </p>
      )}
      {h.error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-brand-red">Couldn&apos;t load the shifts. Refresh to try again.</p>}

      {h.needsFixing.length > 0 && (
        <section className="card space-y-2 p-4 ring-2 ring-amber-200 sm:p-5">
          <div>
            <h2 className="font-bold text-amber-800">Didn&apos;t clock out</h2>
            <p className="text-xs text-stone-500">
              Left on the clock for more than {MAX_SHIFT_HOURS} hours. These count as 0 hours until you put in the time they left (pencil).
            </p>
          </div>
          <div className="space-y-2">{h.needsFixing.map((s) => <ShiftRow key={s.id} s={s} />)}</div>
        </section>
      )}

      <section className="card p-4 sm:p-5">
        <h2 className="mb-2 font-bold text-brand-brown">On the clock now</h2>
        {h.onNow.length === 0 ? (
          <p className="text-sm text-stone-500">Nobody is clocked in right now.</p>
        ) : (
          <ul className="divide-y divide-orange-50">
            {h.onNow.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 text-sm">
                  <p><span className="font-bold">{s.name}</span> <span className="text-stone-500">since {s.inLabel}{s.date !== today && `, ${s.dateLabel}`}</span></p>
                  <p className="font-bold tabular-nums text-green-700">{s.soFar} so far</p>
                </div>
                <ClockOutNow id={s.id} name={s.name} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <RangePicker current={range.key} from={range.from} to={range.to} keys={KEYS} />

      <section className="card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold text-brand-brown">Hours worked</h2>
          <p className="text-xs text-stone-500">{prettyDate(range.from)} – {prettyDate(range.to)} · Nepal time</p>
        </div>
        {h.totals.length === 0 ? (
          <p className="text-sm text-stone-500">No shifts in this period.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {h.totals.map((p) => (
              <div key={p.key} className="rounded-2xl border-l-4 border-brand-orange bg-stone-50 p-4">
                <p className="font-bold">{p.name}</p>
                <p className="font-display text-2xl font-extrabold tabular-nums text-stone-900">{hoursLabel(p.minutes)}</p>
                <p className="text-xs text-stone-500">
                  {p.shifts} shift{p.shifts === 1 ? "" : "s"} · {p.days} day{p.days === 1 ? "" : "s"}
                  {p.on && " · includes the shift running now"}
                </p>
                {p.missed > 0 && <p className="text-xs font-bold text-amber-700">{p.missed} without a clock-out (not counted)</p>}
              </div>
            ))}
          </div>
        )}
        {h.totals.length > 1 && (
          <p className="mt-3 text-sm text-stone-500">All together: <b className="tabular-nums text-stone-800">{hoursLabel(h.totalMinutes)}</b></p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-brand-brown">Shifts</h2>
          <AddShift people={h.people} />
        </div>
        {h.truncated && <p className="text-xs text-amber-700">Showing the latest 3,000 shifts. Pick a shorter period to see them all.</p>}
        {h.rows.length === 0 ? (
          <div className="card p-6 text-center text-sm text-stone-500">No shifts in this period yet.</div>
        ) : (
          <>
            <div className="space-y-2.5 md:hidden">{h.rows.map((s) => <ShiftRow key={s.id} s={s} />)}</div>
            <div className="card hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs font-bold uppercase tracking-wide text-stone-500">
                  <tr><th className={head}>Day</th><th className={head}>Who</th><th className={head}>In</th><th className={head}>Out</th><th className={`${head} text-right`}>Hours</th><th /></tr>
                </thead>
                <tbody>{h.rows.map((s) => <ShiftRow key={s.id} s={s} asTableRow />)}</tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <ClockPeople people={h.people} videoIds={(videos ?? []).map((v) => v.id)} />
    </div>
  );
}
