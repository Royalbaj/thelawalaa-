// Every date and time the app shows is NEPAL time (Asia/Kathmandu, UTC+5:45),
// written the way the shop reads it — "13 Oct 2026, 4:05 pm" — never the
// server's clock (Vercel runs on UTC) or the device's own setting. Use these
// instead of date-fns format() or a bare toLocaleString(). They give the same
// answer in the browser and on the server, so nothing shifts when a page hydrates.
// (lib/dates.ts is the calendar-day maths for reports; this is for showing times.)

const TZ = "Asia/Kathmandu";
const NPT_OFFSET_MS = (5 * 60 + 45) * 60_000;
type When = string | number | Date;

const make = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...o });
const F = {
  time: make({ hour: "numeric", minute: "2-digit", hour12: true }),
  date: make({ day: "numeric", month: "short", year: "numeric" }),
  dayMonth: make({ day: "numeric", month: "short" }),
  dateTime: make({ day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
  dayMonthTime: make({ day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }),
  weekday: make({ weekday: "short", day: "numeric", month: "short" }),
};
const at = (w: When) => (w instanceof Date ? w : new Date(w));

/** "4:05 pm" */
export const npTime = (w: When) => F.time.format(at(w));
/** "13 Oct 2026" */
export const npDate = (w: When) => F.date.format(at(w));
/** "13 Oct" */
export const npDayMonth = (w: When) => F.dayMonth.format(at(w));
/** "13 Oct 2026, 4:05 pm" */
export const npDateTime = (w: When) => F.dateTime.format(at(w));
/** "13 Oct, 4:05 pm" */
export const npDayMonthTime = (w: When) => F.dayMonthTime.format(at(w));
/** "Tue 13 Oct" */
export const npWeekday = (w: When) => F.weekday.format(at(w));

/**
 * What an admin typed in a date-and-time box ("2026-10-20T18:00") means Nepal
 * time — the server must not read it as UTC (that stored 6 pm as 11:45 pm).
 */
export function fromNepalInput(v: string | null | undefined): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)) return null;
  const t = new Date(`${v.slice(0, 16)}:00+05:45`);
  return Number.isNaN(t.getTime()) ? null : t;
}

/** A stored time → the value for a date-and-time box, in Nepal time ("2026-10-20T18:00"). */
export function toNepalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? "" : new Date(t + NPT_OFFSET_MS).toISOString().slice(0, 16);
}
