// Admin → Staff Hours → "Download CSV": hours per person and every shift in
// the period, for paying staff (opens in Excel).
import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/dates";
import { getStaffHours, hoursLabel } from "@/lib/time-clock";

export const dynamic = "force-dynamic";

const cell = (v: string | number | null | undefined) => {
  const s = v == null ? "" : String(v);
  // Quote everything; neutralise spreadsheet formulas in typed notes.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};
const decimalHours = (minutes: number) => (minutes / 60).toFixed(2);

export async function GET(req: NextRequest) {
  try { await requireRole(["super_admin"]); } catch { return new NextResponse("Not allowed", { status: 403 }); }
  const range = resolveRange(Object.fromEntries(req.nextUrl.searchParams), "month");
  const h = await getStaffHours(range.from, range.to);
  const STATE = { done: "", on: "On the clock (so far)", missed: "Didn't clock out (not counted)" };

  const lines = [
    ["Staff hours", `${range.from} to ${range.to} (Nepal time)`],
    [],
    ["Person", "Hours", "Hours (decimal)", "Shifts", "Days", "Without a clock-out"],
    ...h.totals.map((p) => [p.name, hoursLabel(p.minutes), decimalHours(p.minutes), p.shifts, p.days, p.missed]),
    ["All together", hoursLabel(h.totalMinutes), decimalHours(h.totalMinutes)],
    [],
    ["Date", "Person", "Clock in", "Clock out", "Hours (decimal)", "Status", "Changed in admin", "Note"],
    ...[...h.rows].reverse().map((s) => [
      s.date, s.name, s.inHm, s.outHm, s.minutes == null ? "" : decimalHours(s.minutes), STATE[s.state], s.edited ? "yes" : "", s.note ?? "",
    ]),
  ];
  const csv = "﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="thelawalaa-staff-hours-${range.from}-to-${range.to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
