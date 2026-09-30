// Download a sales archive as an Excel workbook — the reset hands this out
// straight away, and Admin → Settings lists every archive to fetch again.
// super_admin only: it contains every customer name and phone number.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getVerifiedUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildSalesArchiveWorkbook, salesArchiveFilename, type SalesArchive } from "@/lib/sales-archive-excel";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { profile } = await getVerifiedUser();
  if (!profile || profile.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await props.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: archive } = await supabaseAdmin
    .from("sales_archives")
    .select("id, created_at, snapshot")
    .eq("id", id)
    .maybeSingle();
  if (!archive) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const file = await buildSalesArchiveWorkbook(archive as SalesArchive);
  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${salesArchiveFilename(archive.created_at)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
