import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Bills live in a private bucket: this hands out a 2-minute link to one.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireAuth(); } catch { return NextResponse.redirect(new URL("/pin", request.url)); }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const { data } = await supabaseAdmin.from("account_transactions").select("bill_path").eq("id", id).single();
  if (!data?.bill_path) return new NextResponse("This entry has no bill", { status: 404 });
  const { data: signed } = await supabaseAdmin.storage.from("account-bills").createSignedUrl(data.bill_path, 120);
  if (!signed?.signedUrl) return new NextResponse("Couldn't open the bill", { status: 502 });
  return NextResponse.redirect(signed.signedUrl);
}
