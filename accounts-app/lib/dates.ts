// The book works in calendar dates in Nepal (UTC+5:45), never the server's
// clock — Vercel runs on UTC, which is still "yesterday" until 5:45 am in
// Banepa. Dates travel as "YYYY-MM-DD" strings; the maths is done in UTC so
// no timezone can shift a day.

export type Ymd = string;

const NPT_OFFSET_MS = (5 * 60 + 45) * 60_000;
const DAY_MS = 86_400_000;

const toUtc = (d: Ymd) => new Date(`${d}T00:00:00Z`);
const ymd = (t: Date): Ymd => t.toISOString().slice(0, 10);

export const nepalToday = (): Ymd => ymd(new Date(Date.now() + NPT_OFFSET_MS));
export const isYmd = (s: unknown): s is Ymd =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUtc(s).getTime()) && ymd(toUtc(s)) === s;

export const addDays = (d: Ymd, n: number): Ymd => ymd(new Date(toUtc(d).getTime() + n * DAY_MS));
/** Nepal's week runs Sunday → Saturday. */
export const startOfWeek = (d: Ymd): Ymd => addDays(d, -toUtc(d).getUTCDay());
export const startOfMonth = (d: Ymd): Ymd => `${d.slice(0, 7)}-01`;
/** First day of the month n months away. */
export const addMonths = (d: Ymd, n: number): Ymd => {
  const t = toUtc(startOfMonth(d));
  t.setUTCMonth(t.getUTCMonth() + n);
  return ymd(t);
};
export const endOfMonth = (d: Ymd): Ymd => addDays(addMonths(d, 1), -1);
/** Days from → to, both included. */
export const dayCount = (from: Ymd, to: Ymd) => Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / DAY_MS) + 1;

export function eachDay(from: Ymd, to: Ymd): Ymd[] {
  const out: Ymd[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
/** First day of every month that the range touches. */
export function eachMonth(from: Ymd, to: Ymd): Ymd[] {
  const out: Ymd[] = [];
  for (let m = startOfMonth(from); m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

const fmt = (d: Ymd, o: Intl.DateTimeFormatOptions) => toUtc(d).toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
export const longDate = (d: Ymd) => fmt(d, { weekday: "short", day: "numeric", month: "short", year: "numeric" }); // Fri, 2 Oct 2026
export const prettyDate = (d: Ymd) => fmt(d, { day: "numeric", month: "short", year: "numeric" }); // 2 Oct 2026
export const shortDate = (d: Ymd) => fmt(d, { day: "numeric", month: "short" }); // 2 Oct
export const monthLabel = (d: Ymd) => fmt(d, { month: "short", year: "numeric" }); // Oct 2026

// ── Named ranges (dashboard, entries, reports) ──────────────────
export const RANGES = {
  today: "Today",
  week: "This week",
  month: "This month",
  "last-month": "Last month",
  "3-months": "Last 3 months",
  year: "This year",
  custom: "Pick dates",
} as const;
export type RangeKey = keyof typeof RANGES;
export type Range = { key: RangeKey; from: Ymd; to: Ymd; label: string };

/** Turns ?range=…&from=…&to=… into concrete dates; anything odd falls back. */
export function resolveRange(params: { range?: string; from?: string; to?: string }, fallback: RangeKey = "month"): Range {
  const today = nepalToday();
  const key = (params.range && params.range in RANGES ? params.range : fallback) as RangeKey;
  const named = (k: RangeKey, from: Ymd, to: Ymd): Range => ({ key: k, from, to, label: RANGES[k] });
  switch (key) {
    case "today": return named(key, today, today);
    case "week": return named(key, startOfWeek(today), today);
    case "month": return named(key, startOfMonth(today), today);
    case "last-month": return named(key, addMonths(today, -1), addDays(startOfMonth(today), -1));
    case "3-months": return named(key, addMonths(today, -2), today);
    case "year": return named(key, `${today.slice(0, 4)}-01-01`, today);
    case "custom": {
      if (!isYmd(params.from) || !isYmd(params.to)) return resolveRange({}, fallback);
      let [from, to] = params.from <= params.to ? [params.from, params.to] : [params.to, params.from];
      if (dayCount(from, to) > 366 * 3) from = addDays(to, -366 * 3); // keep a page to a sane size
      return { key, from, to, label: from === to ? prettyDate(from) : `${prettyDate(from)} – ${prettyDate(to)}` };
    }
  }
}

/** Query string for a range — keeps links and downloads on the same dates. */
export const rangeQuery = (r: Range) =>
  r.key === "custom" ? `range=custom&from=${r.from}&to=${r.to}` : `range=${r.key}`;
