// Authenticated JSON feed for the realtime dashboard refetch.
// Admin-only; data flows through the service role AFTER the role check.
import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { profile } = await getVerifiedUser();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, status, type, total, payment_status, payment_method, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  return NextResponse.json(data ?? []);
}
