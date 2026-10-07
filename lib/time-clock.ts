import "server-only";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { addDays, type Ymd } from "@/lib/dates";

// POS time clock (migration 036). Counter staff clock in and out on the
// shared POS login with their own PIN (training_people, pos_clock = true).
// Only the admin sees hours (Admin → Staff Hours); the POS shows times only.
//
// A shift belongs to the Nepal day it started on. One left open for more
// than 16 hours was a forgotten clock-out: it counts as 0 h ("missed") until
// the admin puts in the real time.

export const MAX_SHIFT_HOURS = 16;
const HOUR = 3_600_000;
const NPT_OFFSET_MS = (5 * 60 + 45) * 60_000;

export const isStale = (clockIn: string, now = Date.now()) => now - new Date(clockIn).getTime() > MAX_SHIFT_HOURS * HOUR;

/** Nepal calendar day / 24-hour "HH:MM" of an instant — what the admin's edit form shows. */
export const nepalYmd = (iso: string): Ymd => new Date(new Date(iso).getTime() + NPT_OFFSET_MS).toISOString().slice(0, 10);
export const nepalHm = (iso: string) => new Date(new Date(iso).getTime() + NPT_OFFSET_MS).toISOString().slice(11, 16);
/** A Nepal date + "HH:MM" back to an instant. */
export const fromNepal = (date: Ymd, hm: string) => new Date(`${date}T${hm}:00+05:45`);
/** Midnight in Banepa at the start of that day, as an ISO instant. */
export const nepalMidnight = (date: Ymd) => `${date}T00:00:00+05:45`;

export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit", hour12: true });

/** 465 → "7 h 45 min". */
export function hoursLabel(minutes: number) {
  const t = Math.round(minutes);
  const h = Math.floor(t / 60), m = t % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

type ShiftDb = {
  id: string; person_id: string | null; person_name: string; clock_in: string; clock_out: string | null;
  missed_out: boolean; note: string | null; edited_at: string | null;
};
const COLUMNS = "id, person_id, person_name, clock_in, clock_out, missed_out, note, edited_at";

export type ShiftRow = {
  id: string; personId: string | null; name: string;
  clockIn: string; date: Ymd; dateLabel: string;
  inLabel: string; outLabel: string | null;
  inHm: string; outHm: string;                // for the edit form ("" = no clock-out yet)
  minutes: number | null;                     // null = still on the clock / never clocked out
  hours: string | null;                       // minutes as "7 h 45 min"
  state: "done" | "on" | "missed";
  note: string | null; edited: boolean;
};
export type PersonHours = { key: string; name: string; minutes: number; shifts: number; days: number; missed: number; on: boolean };

function toRow(s: ShiftDb, now: number): ShiftRow {
  const missed = s.missed_out || (!s.clock_out && isStale(s.clock_in, now));
  const date = nepalYmd(s.clock_in);
  const minutes = s.clock_out ? (new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 60_000 : null;
  return {
    id: s.id, personId: s.person_id, name: s.person_name,
    clockIn: s.clock_in, date, dateLabel: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }),
    inLabel: clockTime(s.clock_in),
    outLabel: s.clock_out ? `${clockTime(s.clock_out)}${nepalYmd(s.clock_out) !== date ? " (next day)" : ""}` : null,
    inHm: nepalHm(s.clock_in), outHm: s.clock_out ? nepalHm(s.clock_out) : "",
    minutes, hours: minutes == null ? null : hoursLabel(minutes),
    state: s.clock_out ? "done" : missed ? "missed" : "on",
    note: s.note, edited: !!s.edited_at,
  };
}

/** Admin → Staff Hours: every shift in the period, hours per person, who's on now and what needs fixing. */
export async function getStaffHours(from: Ymd, to: Ymd) {
  const now = Date.now();
  const [{ data: shifts, error }, { data: unfinished }, { data: people }] = await Promise.all([
    supabaseAdmin.from("staff_shifts").select(COLUMNS)
      .gte("clock_in", nepalMidnight(from)).lt("clock_in", nepalMidnight(addDays(to, 1)))
      .order("clock_in", { ascending: false }).limit(3000),
    // No clock-out yet — on the clock now, or forgotten (any date).
    supabaseAdmin.from("staff_shifts").select(COLUMNS).is("clock_out", null).order("clock_in"),
    supabaseAdmin.from("training_people").select("id, name, pos_clock").eq("is_active", true).order("name"),
  ]);

  const rows = ((shifts ?? []) as ShiftDb[]).map((s) => toRow(s, now));
  const open = ((unfinished ?? []) as ShiftDb[]).map((s) => toRow(s, now));

  // Hours per person: finished shifts, plus the one running now so far. Missed ones count 0 until fixed.
  const byPerson = new Map<string, PersonHours & { dates: Set<string> }>();
  for (const r of rows) {
    const key = r.personId ?? `name:${r.name}`;
    const p = byPerson.get(key) ?? { key, name: r.name, minutes: 0, shifts: 0, days: 0, missed: 0, on: false, dates: new Set<string>() };
    p.shifts += 1;
    p.dates.add(r.date);
    if (r.state === "done") p.minutes += r.minutes ?? 0;
    else if (r.state === "on") { p.minutes += (now - new Date(r.clockIn).getTime()) / 60_000; p.on = true; }
    else p.missed += 1;
    byPerson.set(key, p);
  }
  const totals: PersonHours[] = [...byPerson.values()]
    .map(({ dates, ...p }) => ({ ...p, days: dates.size }))
    .sort((a, b) => b.minutes - a.minutes);

  return {
    rows,
    totals,
    totalMinutes: totals.reduce((s, p) => s + p.minutes, 0),
    onNow: open.filter((r) => r.state === "on").map((r) => ({ ...r, soFar: hoursLabel((now - new Date(r.clockIn).getTime()) / 60_000) })),
    needsFixing: open.filter((r) => r.state === "missed"),
    truncated: (shifts?.length ?? 0) >= 3000,
    error: !!error,
    people: (people ?? []) as { id: string; name: string; pos_clock: boolean }[],
  };
}

/**
 * Someone is switched off, taken off the POS clock or removed while still
 * clocked in: end that shift now — or, if it's been open too long, mark it
 * missed so the admin puts in the real time.
 */
export async function closeOpenShift(personId: string, actorId: string) {
  const { data } = await supabaseAdmin.from("staff_shifts").select("id, clock_in, person_name")
    .eq("person_id", personId).is("clock_out", null).eq("missed_out", false).maybeSingle();
  if (!data) return;
  const stale = isStale(data.clock_in);
  await supabaseAdmin.from("staff_shifts")
    .update(stale ? { missed_out: true } : { clock_out: new Date().toISOString(), out_by: actorId })
    .eq("id", data.id);
  await audit({ actor_id: actorId, action: stale ? "SHIFT_MISSED" : "CLOCK_OUT", target_table: "staff_shifts", target_id: data.id,
    new_data: { person: data.person_name, by: "admin (switched off)" } });
}
