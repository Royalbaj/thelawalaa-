import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/dates";
import { getSalesReport } from "@/lib/sales-report";
import { buildSalesWorkbook } from "@/lib/sales-report-excel";

// Admin → Reports → Download Excel: the same period as on screen. The layout
// (daily sales highlighted, orders by day…) is in lib/sales-report-excel.ts.
export async function GET(request: Request) {
  const { profile } = await getVerifiedUser();
  if (profile?.role !== "super_admin") return new NextResponse("Not allowed", { status: 403 });
  const range = resolveRange(Object.fromEntries(new URL(request.url).searchParams), "month");
  const wb = buildSalesWorkbook(await getSalesReport(range.from, range.to), range);
  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="thelawalaa-sales_${range.from}_to_${range.to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
