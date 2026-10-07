// Delivery hours and booked delivery slots (migration 039, Admin → Settings →
// Delivery hours). Shared by checkout (what it offers) and createOrder (what
// it accepts) so the two can't disagree. Banepa local time — Nepal is
// UTC+5:45 all year (no daylight saving), so plain offset maths is exact.

const NPT_OFFSET_MS = (5 * 60 + 45) * 60_000;
const DAY_MS = 86_400_000;
const MIN_MS = 60_000;

/** Minutes after midnight (start/end), lengths in minutes. */
export type DeliveryHours = { enabled: boolean; start: number; end: number; slot: number; lead: number; days: number };
export type Slot = { start: string; end: string }; // ISO instants

type SettingsLike = {
  delivery_hours_enabled?: boolean | null; delivery_start?: string | null; delivery_end?: string | null;
  delivery_slot_minutes?: number | null; delivery_lead_minutes?: number | null; delivery_days_ahead?: number | null;
};

const toMinutes = (t: string | null | undefined, fallback: number) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback;
};

export function deliveryHours(s: SettingsLike | null | undefined): DeliveryHours {
  return {
    enabled: !!s?.delivery_hours_enabled,
    start: toMinutes(s?.delivery_start, 11 * 60),
    end: toMinutes(s?.delivery_end, 20 * 60),
    slot: Number(s?.delivery_slot_minutes ?? 30),
    lead: Math.max(30, Number(s?.delivery_lead_minutes ?? 30)), // never less than 30 minutes' notice
    days: Number(s?.delivery_days_ahead ?? 2),
  };
}

/** Banepa midnight at the start of the Nepal day that contains `t` (epoch ms). */
const nepalMidnight = (t: number) => Math.floor((t + NPT_OFFSET_MS) / DAY_MS) * DAY_MS - NPT_OFFSET_MS;
const minuteOfDay = (t: number) => Math.floor(((t + NPT_OFFSET_MS) % DAY_MS) / MIN_MS);

/** Can "as soon as possible" delivery be ordered right now? With the hours off, always. */
export function deliveryOpenNow(h: DeliveryHours, now = Date.now()) {
  if (!h.enabled) return true;
  const m = minuteOfDay(now);
  return m >= h.start && m < h.end;
}

/** When delivery next opens (epoch ms): today's start if it's still ahead, otherwise tomorrow's. */
export function nextDeliveryStart(h: DeliveryHours, now = Date.now()) {
  const today = nepalMidnight(now) + h.start * MIN_MS;
  return now < today ? today : today + DAY_MS;
}

/**
 * Slots a customer can book: `slot` minutes each, inside the hours, starting
 * at least `lead` minutes from now, over today and the next days.
 */
export function deliverySlots(h: DeliveryHours, now = Date.now()): Slot[] {
  if (!h.enabled || h.slot <= 0 || h.end <= h.start) return [];
  const earliest = now + h.lead * MIN_MS;
  const day0 = nepalMidnight(now);
  const out: Slot[] = [];
  for (let d = 0; d < h.days; d++) {
    for (let m = h.start; m + h.slot <= h.end; m += h.slot) {
      const s = day0 + d * DAY_MS + m * MIN_MS;
      if (s >= earliest) out.push({ start: new Date(s).toISOString(), end: new Date(s + h.slot * MIN_MS).toISOString() });
    }
  }
  return out;
}

/** The slot starting at `startIso`, if it can still be booked — what createOrder trusts. */
export function bookableSlot(h: DeliveryHours, startIso: string, now = Date.now()): Slot | null {
  const t = new Date(startIso).getTime();
  if (Number.isNaN(t)) return null;
  return deliverySlots(h, now).find((s) => new Date(s.start).getTime() === t) ?? null;
}

// ── Words ────────────────────────────────────────────────────────
const timeFmt = (t: number) =>
  new Date(t).toLocaleTimeString("en-GB", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit", hour12: true });

/** 660 → "11:00 am". */
export const minutesLabel = (m: number) => timeFmt(Date.UTC(2000, 0, 1) - NPT_OFFSET_MS + m * MIN_MS);

/** "Today" / "Tomorrow" / "Fri 9 Oct" for an instant, in Nepal days. */
export function dayWord(t: number, now = Date.now()) {
  const diff = Math.round((nepalMidnight(t) - nepalMidnight(now)) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return new Date(t).toLocaleDateString("en-GB", { timeZone: "Asia/Kathmandu", weekday: "short", day: "numeric", month: "short" });
}

/** "Today 6:00–6:30 pm" / "Today 11:30 am–12:00 pm" — short enough for a phone's dropdown. */
export function slotLabel(slot: { start: string; end: string }, now = Date.now()) {
  const s = new Date(slot.start).getTime(), e = new Date(slot.end).getTime();
  const from = timeFmt(s), to = timeFmt(e);
  const sameHalf = from.slice(-2) === to.slice(-2);
  return `${dayWord(s, now)} ${sameHalf ? from.slice(0, -3) : from}–${to}`;
}

/** "today at 11:00 am" / "tomorrow at 11:00 am" — when delivery next opens. */
export function nextStartLabel(h: DeliveryHours, now = Date.now()) {
  const t = nextDeliveryStart(h, now);
  return `${dayWord(t, now).toLowerCase()} at ${timeFmt(t)}`;
}
