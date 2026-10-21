import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { audit, supabaseAdmin } from "@/lib/supabase/admin";
import { resendClient, EMAIL_DOMAIN } from "@/lib/email";
import { getReceivingStatus, recheckDomain, syncInbox, turnOnReceiving } from "@/lib/inbox";

// TEMPORARY (Oct 2026): switches receiving on from the command line while the
// production Resend key stays hidden in Vercel — the same steps as Admin →
// Email → "Turn on receiving". Locked by EMAIL_SETUP_TOKEN (a Vercel env var);
// without it this answers 404. Remove the route and the env var once done.

function allowed(request: Request) {
  const token = process.env.EMAIL_SETUP_TOKEN;
  if (!token || token.length < 32) return false;
  const sent = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const hash = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(hash(sent), hash(token));
}

export async function POST(request: Request) {
  if (!allowed(request)) return new NextResponse("Not found", { status: 404 });
  const { action } = (await request.json().catch(() => ({}))) as { action?: string };
  const out: Record<string, unknown> = {};

  if (action === "enable") {
    const r = await turnOnReceiving();
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 502 });
    await audit({ actor_id: null, action: "EMAIL_RECEIVING_ON", target_table: "email_inbox_settings", new_data: { domain: EMAIL_DOMAIN, webhook: r.webhookId, via: "setup" } });
  }
  if (action === "recheck") await recheckDomain();
  if (action === "test") {
    // A real email from us to admin@ — it goes out, comes back through the MX record and lands in the inbox.
    const { data, error } = await resendClient()!.emails.send({
      from: `Thelawalaa <hello@${EMAIL_DOMAIN}>`, to: `admin@${EMAIL_DOMAIN}`,
      subject: "Inbox test — receiving works",
      text: "This test was sent to admin@thelawalaa.com to check that email to Thelawalaa now arrives in Admin → Email → Inbox. You can archive it.",
    });
    out.test = error ? { error: error.message } : { id: data?.id };
  }
  if (action === "sync" || action === "recheck") out.sync = await syncInbox();

  const { data: latest, count } = await supabaseAdmin.from("inbox_emails").select("subject, received_at", { count: "exact" })
    .order("received_at", { ascending: false }).limit(3);
  return NextResponse.json({ ...out, status: await getReceivingStatus(), inbox: { count, latest } });
}
