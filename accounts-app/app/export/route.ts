import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import { resolveRange } from "@/lib/dates";
import { getCategories, getEntries, getBalance, type Kind } from "@/lib/ledger";
import { buildCsv, buildWorkbook, exportFileBase } from "@/lib/export";

// Download of the money book for a period: Excel (Summary, Entries, By day/
// month) or a plain CSV of the entries. Same filters as /entries.
export async function GET(request: Request) {
  try { await requireAuth(); } catch { return NextResponse.redirect(new URL("/pin", request.url)); }
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const range = resolveRange(sp, "month");
  const filter = {
    kind: sp.kind === "in" || sp.kind === "out" ? (sp.kind as Kind) : undefined,
    categoryId: /^[0-9a-f-]{36}$/.test(sp.cat ?? "") ? sp.cat : undefined,
    q: (sp.q ?? "").trim().slice(0, 60) || undefined,
    missingBill: sp.nobill === "1",
    personId: /^[0-9a-f-]{36}$/.test(sp.by ?? "") ? sp.by : undefined,
  };
  const [categories, entries, before] = await Promise.all([
    getCategories(), getEntries(range.from, range.to, filter), getBalance(range.from),
  ]);
  const input = { range, categories, entries, balanceBefore: before.balance, filter };
  const base = exportFileBase(range);

  if (sp.format === "csv") {
    return new NextResponse(buildCsv(input), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"`, "Cache-Control": "no-store" },
    });
  }
  return new NextResponse(await buildWorkbook(input), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${base}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
