import { NextResponse } from "next/server";
import { resendClient } from "@/lib/email";
import { forwardReceived, inboxSettings, saveReceived } from "@/lib/inbox";

/**
 * Resend's "email.received" webhook (created by Admin → Email → Inbox →
 * "Turn on receiving", which stores its signing secret). The signature is
 * checked, and the email itself is then fetched from Resend's API by id —
 * the webhook body is only a nudge, never the content.
 */
export async function POST(request: Request) {
  const resend = resendClient();
  const settings = await inboxSettings();
  if (!resend || !settings.webhook_secret) return NextResponse.json({ error: "Receiving isn't set up" }, { status: 503 });

  const payload = await request.text();
  let event: ReturnType<typeof resend.webhooks.verify>;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret: settings.webhook_secret,
    });
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  if (event.type !== "email.received") return NextResponse.json({ ok: true, ignored: event.type });

  const saved = await saveReceived(event.data.email_id);
  // A failure here makes Resend retry later; a repeat is harmless (saved once).
  if (saved.error) return NextResponse.json({ error: saved.error }, { status: 502 });
  if (saved.isNew && saved.row && settings.forward_to) await forwardReceived(saved.row, settings.forward_to);
  return NextResponse.json({ ok: true });
}
