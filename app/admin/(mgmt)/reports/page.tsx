import { requireRole } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/dates";
import { getSalesReport } from "@/lib/sales-report";
import SalesReportView from "@/components/admin/sales-report-view";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireRole(["super_admin"]);
  const range = resolveRange(await searchParams, "month");
  return <SalesReportView range={range} r={await getSalesReport(range.from, range.to)} />;
}
