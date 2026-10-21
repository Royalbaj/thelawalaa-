"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { resendClient, EMAIL_DOMAIN } from "@/lib/email";
import { getReceivingStatus, recheckDomain, syncInbox, turnOnReceiving } from "@/lib/inbox";

// Admin → Email → Inbox: receiving email at @thelawalaa.com. Turning it on
// (1) switches on receiving for the domain in Resend, which hands back ONE MX
// record to add in Vercel DNS, and (2) creates the Resend webhook that tells
// /api/email/received about each new email, keeping its signing secret.

export type { ReceivingStatus } from "@/lib/inbox";

/** Where receiving stands (Admin → Email → Inbox). */
export async function receivingStatus() {
  await requireRole(["super_admin"]);
  return getReceivingStatus();
}

/** "Turn on receiving": domain capability + webhook. Safe to press again (repairs a missing webhook). */
export async function enableReceiving() {
  const { user } = await requireRole(["super_admin"]);
  const r = await turnOnReceiving();
  if ("error" in r) return { error: r.error };
  await audit({ actor_id: user.id, action: "EMAIL_RECEIVING_ON", target_table: "email_inbox_settings", new_data: { domain: EMAIL_DOMAIN, webhook: r.webhookId } });
  revalidatePath("/admin/email");
  return { ok: true, status: r.status };
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

/** Where a copy of every received email also goes ("" = nowhere). Never our own domain — it would loop. */
export async function setInboxForward(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = z.object({ to: z.string().trim().toLowerCase().max(200).email("Check the email address").or(z.literal("")) }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the email address" };
  const to = parsed.data.to;
  if (to.endsWith(`@${EMAIL_DOMAIN}`)) return { error: `Use an address outside ${EMAIL_DOMAIN} (like your Gmail) — a copy sent back to ${EMAIL_DOMAIN} would arrive here again` };
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
