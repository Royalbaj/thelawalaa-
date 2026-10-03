// Serving time (migration 028): orders.ready_at / served_at are stamped by the
// database the first time an order reaches Ready / is handed over. "Serving
// time" = order placed → handed over (Served / Collected / Delivered);
// "kitchen time" = order placed → Ready. An order left open for hours is a
// forgotten tap, not a slow kitchen, so anything over MAX_MIN is left out.

export const MAX_MIN = 180;

export type TimedOrder = { created_at: string; ready_at?: string | null; served_at?: string | null; status: string; placed_by?: string | null };
export type ServingStats = { avgServe: number | null; avgReady: number | null; served: number; readied: number };

const minutes = (from: string, to: string | null | undefined) => {
  if (!to) return null;
  const m = (new Date(to).getTime() - new Date(from).getTime()) / 60_000;
  return m >= 0 && m <= MAX_MIN ? m : null;
};
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export function servingStats(orders: TimedOrder[]): ServingStats {
  const live = orders.filter((o) => o.status !== "cancelled");
  const serve = live.map((o) => minutes(o.created_at, o.served_at)).filter((m): m is number => m != null);
  const ready = live.map((o) => minutes(o.created_at, o.ready_at)).filter((m): m is number => m != null);
  return { avgServe: avg(serve), avgReady: avg(ready), served: serve.length, readied: ready.length };
}

/** 8.5 → "8 min 30 s", 75 → "1 h 15 min", null → "—". */
export function fmtMinutes(m: number | null): string {
  if (m == null) return "—";
  if (m < 1) return `${Math.round(m * 60)} s`;
  if (m < 60) {
    const whole = Math.floor(m), s = Math.round((m - whole) * 60);
    return s && whole < 10 ? `${whole} min ${s} s` : `${Math.round(m)} min`;
  }
  return `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`;
}
