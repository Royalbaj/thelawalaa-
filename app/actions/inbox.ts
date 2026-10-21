"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { resendClient, EMAIL_DOMAIN } from "@/lib/email";
import { forwardReceived, getReceivingStatus, inboxSettings, recheckDomain, syncInbox, turnOnReceiving, type InboxRow } from "@/lib/inbox";

// Admin → Email → Inbox: receiving email at @thelawalaa.com. "Turn on"
// (connectInbox) switches on receiving for the domain in Resend (which needs
// ONE MX record in Vercel DNS), creates the Resend webhook that tells
// /api/email/received about each new email, and saves the Gmail that every
// email is copied to.

export type { ReceivingStatus } from "@/lib/inbox";

/** Where receiving stands (Admin → Email → Inbox). */
export async function receivingStatus() {
  await requireRole(["super_admin"]);
  return getReceivingStatus();
}

/** "Check again" after adding the MX record: Resend re-checks DNS, then the inbox pulls anything new. */
export async function recheckReceiving() {
  await requireRole(["super_admin"]);
  if (!resendClient()) return { error: "No RESEND_API_KEY is set in Vercel" };
  await recheckDomain();
  const sync = await syncInbox();
  revalidatePath("/admin/email");
  return { ok: true, status: await getReceivingStatus(), added: sync.added };
}

const forwardSchema = z.object({ to: z.string().trim().toLowerCase().max(200).email("Check the email address").or(z.literal("")) });
const ownDomain = (to: string) => to.endsWith(`@${EMAIL_DOMAIN}`)
  ? `Use an address outside ${EMAIL_DOMAIN} (like your Gmail) — a copy sent back to ${EMAIL_DOMAIN} would arrive here again` : null;

/** Emails that arrived before the Gmail was set (Resend kept them) go there too, oldest first. */
async function forwardBacklog(to: string) {
  const { data: waiting } = await supabaseAdmin.from("inbox_emails").select("*")
    .is("forwarded_to", null).is("archived_at", null).order("received_at", { ascending: true }).limit(30);
  let forwarded = 0;
  for (const row of (waiting ?? []) as InboxRow[]) if (!(await forwardReceived(row, to)).error) forwarded++;
  return forwarded;
}

/** "Send them to Gmail": the inbox emails that haven't been copied to the Gmail yet. */
export async function forwardWaiting() {
  const { user } = await requireRole(["super_admin"]);
  const { forward_to: to } = await inboxSettings();
  if (!to) return { error: "Save the Gmail address first" };
  const forwarded = await forwardBacklog(to);
  await audit({ actor_id: user.id, action: "EMAIL_INBOX_FORWARD", target_table: "inbox_emails", new_data: { forward_to: to, forwarded } });
  revalidatePath("/admin/email");
  return forwarded ? { ok: true, forwarded } : { error: `Couldn't send them to ${to} — try again in a minute` };
}

/**
 * The one-step setup: "Get every email in Gmail". Turns receiving on (with the
 * webhook), saves the Gmail, asks Resend to re-check the MX record, pulls in
 * what Resend has already received, and sends those to the Gmail too.
 */
export async function connectInbox(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = forwardSchema.safeParse(input);
  if (!parsed.success || !parsed.data.to) return { error: parsed.success ? "Type the Gmail address to send everything to" : parsed.error.issues[0]?.message ?? "Check the email address" };
  const to = parsed.data.to;
  const bad = ownDomain(to);
  if (bad) return { error: bad };

  const r = await turnOnReceiving();
  if ("error" in r) return { error: r.error };
  await supabaseAdmin.from("email_inbox_settings").update({ forward_to: to, updated_at: new Date().toISOString() }).eq("id", 1);
  await recheckDomain();
  const sync = await syncInbox();

  const forwarded = await forwardBacklog(to);

  await audit({ actor_id: user.id, action: "EMAIL_RECEIVING_ON", target_table: "email_inbox_settings",
    new_data: { domain: EMAIL_DOMAIN, webhook: r.webhookId, forward_to: to, received: sync.added, forwarded } });
  revalidatePath("/admin", "layout");
  return { ok: true, status: await getReceivingStatus(), received: sync.added, forwarded };
}

/** Where a copy of every received email also goes ("" = nowhere). Never our own domain — it would loop. */
export async function setInboxForward(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = forwardSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the email address" };
  const to = parsed.data.to;
  const bad = ownDomain(to);
  if (bad) return { error: bad };
  await supabaseAdmin.from("email_inbox_settings").update({ forward_to: to || null, updated_at: new Date().toISOString() }).eq("id", 1);
  await audit({ actor_id: user.id, action: "EMAIL_INBOX_FORWARD", target_table: "email_inbox_settings", new_data: { forward_to: to || null } });
  revalidatePath("/admin/email");
  return { ok: true };
}

const idSchema = z.string().uuid();

export async function markInboxRead(id: unknown) {
  await requireRole(["super_admin"]);
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { error: "Not found" };
  await supabaseAdmin.from("inbox_emails").update({ read_at: new Date().toISOString() }).eq("id", parsed.data).is("read_at", null);
  revalidatePath("/admin", "layout"); // the menu's unread count
  return { ok: true };
}

export async function setInboxState(input: unknown) {
  await requireRole(["super_admin"]);
  const parsed = z.object({ id: idSchema, archived: z.boolean().optional(), unread: z.boolean().optional() }).safeParse(input);
  if (!parsed.success) return { error: "Not found" };
  const { id, archived, unread } = parsed.data;
  const patch: Record<string, string | null> = {};
  if (archived !== undefined) patch.archived_at = archived ? new Date().toISOString() : null;
  if (unread !== undefined) patch.read_at = unread ? null : new Date().toISOString();
  if (!Object.keys(patch).length) return { ok: true };
  await supabaseAdmin.from("inbox_emails").update(patch).eq("id", id);
  revalidatePath("/admin", "layout");
  return { ok: true };
}
