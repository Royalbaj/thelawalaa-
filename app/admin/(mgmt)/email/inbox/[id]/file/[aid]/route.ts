import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { attachmentLink, type InboxAttachment } from "@/lib/inbox";

// A file sent with a received email: Resend keeps it and hands out a short-lived link.
export async function GET(request: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  try { await requireRole(["super_admin"]); } catch {
    return NextResponse.redirect(new URL("/auth/login?redirect=/admin/email", request.url));
  }
  const { id, aid } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id) || !/^[\w-]{1,100}$/.test(aid)) return new NextResponse("Not found", { status: 404 });
  const { data } = await supabaseAdmin.from("inbox_emails").select("resend_id, attachments").eq("id", id).maybeSingle();
  if (!data || !(data.attachments as InboxAttachment[]).some((a) => a.id === aid)) return new NextResponse("Not found", { status: 404 });
  const url = await attachmentLink(data.resend_id, aid);
  if (!url) return new NextResponse("Couldn't open the file — Resend may no longer keep it", { status: 502 });
  return NextResponse.redirect(url);
}
