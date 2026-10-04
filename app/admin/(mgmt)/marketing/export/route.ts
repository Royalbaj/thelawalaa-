// Admin → Marketing & ROI → "Download CSV": the month's expenses and returns,
// with the totals, for the books (opens in Excel).
import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/supabase/server";
import { getMarketing } from "@/lib/marketing";
import { CATEGORY_SHORT, PAYMENT_METHODS, pct } from "@/lib/marketing-shared";

export const dynamic = "force-dynamic";

const cell = (v: string | number | null | undefined) => {
  const s = v == null ? "" : String(v);
  // Quote everything; neutralise spreadsheet formulas in typed notes.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

export async function GET(req: NextRequest) {
  try { await requireRole(["super_admin"]); } catch { return new NextResponse("Not allowed", { status: 403 }); }
  const d = await getMarketing(req.nextUrl.searchParams.get("month") ?? undefined);
  const lines = [
    ["Date", "Type", "Category", "Activity", "Amount (Rs)", "Paid by", "New customers", "Note"],
    ...[...d.month.entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date)).map((e) => [
      e.entry_date, e.kind === "expense" ? "Expense" : "Return", CATEGORY_SHORT[e.category], e.activity ?? "",
      e.kind === "expense" ? -e.amount : e.amount, e.payment_method ? PAYMENT_METHODS[e.payment_method] : "", e.new_customers ?? "", e.note ?? "",
    ]),
    [],
    ["Month", d.label],
    ["Budget", d.budget.total ?? "not set"],
    ["Spent", d.month.spent],
    ["Returns", d.month.returned],
    ["Net", d.month.net],
    ["ROI", pct(d.month.roi)],
    ["Shop sales (paid)", d.sales.thisMonth],
    ["Marketing as % of sales", pct(d.sales.share, 1)],
  ];
  const csv = "﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="thelawalaa-marketing-${d.ym}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
