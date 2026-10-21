"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { resendClient, EMAIL_DOMAIN } from "@/lib/email";
import { INBOX_WEBHOOK_URL, inboxSettings, syncInbox } from "@/lib/inbox";

// Admin → Email → Inbox: receiving email at @thelawalaa.com. Turning it on
// (1) switches on receiving for the domain in Resend, which hands back ONE MX
// record to add in Vercel DNS, and (2) creates the Resend webhook that tells
// /api/email/received about each new email, keeping its signing secret.

export type ReceivingStatus =
  | { state: "no_key" }
  | { state: "no_domain" }
  | { state: "error"; error: string }
  | { state: "off" }
  | { state: "on"; record: { name: string; value: string; priority: number; status: string } | null; webhook: boolean };

/** Our domain's id in Resend (null = not added), or what went wrong. */
async function findDomain(): Promise<{ id: string | null; error: string | null }> {
  const list = await resendClient()!.domains.list();
  if (list.error) return { id: null, error: list.error.message };
  return { id: (list.data?.data ?? []).find((d) => d.name === EMAIL_DOMAIN)?.id ?? null, error: null };
}

/** Where receiving stands: switched on in Resend, the MX record's DNS check, the webhook. */
export async function receivingStatus(): Promise<ReceivingStatus> {
  await requireRole(["super_admin"]);
  const resend = resendClient();
  if (!resend) return { state: "no_key" };
  try {
    const d = await findDomain();
    if (d.error) return { state: "error", error: d.error };
    if (!d.id) return { state: "no_domain" };
    const got = await resend.domains.get(d.id);
    if (got.error || !got.data) return { state: "error", error: got.error?.message ?? "Couldn't read the domain" };
    if (got.data.capabilities?.receiving !== "enabled") return { state: "off" };
    const mx = got.data.records.find((r) => r.record === "Receiving");
    const s = await inboxSettings();
    return {
      state: "on", webhook: !!s.webhook_secret,
      record: mx ? { name: mx.name, value: mx.value, priority: Number("priority" in mx ? mx.priority : 10), status: mx.status } : null,
    };
  } catch (e) {
    return { state: "error", error: e instanceof Error ? e.message : "Couldn't reach Resend" };
  }
}

/** "Turn on receiving": domain capability + webhook. Safe to press again (repairs a missing webhook). */
export async function enableReceiving() {
  const { user } = await requireRole(["super_admin"]);
  const resend = resendClient();
  if (!resend) return { error: "No RESEND_API_KEY is set in Vercel" };
  const d = await findDomain();
  if (d.error) return { error: d.error };
  if (!d.id) return { error: `${EMAIL_DOMAIN} isn't in Resend yet — add it in Admin → Settings → Email setup first` };

  const upd = await resend.domains.update({ id: d.id, capabilities: { receiving: "enabled" } });
  if (upd.error) return { error: upd.error.message };

  // Reuse a webhook already pointing at us (made earlier, or in Resend's dashboard), else create one.
  const s = await inboxSettings();
  let hook: { id: string; secret: string } | null = null;
  if (s.webhook_id) {
    const w = await resend.webhooks.get(s.webhook_id);
    if (w.data && w.data.endpoint === INBOX_WEBHOOK_URL && w.data.status === "enabled") hook = { id: w.data.id, secret: w.data.signing_secret };
  }
  if (!hook) {
    const all = await resend.webhooks.list();
    const mine = all.data?.data.find((w) => w.endpoint === INBOX_WEBHOOK_URL && w.status === "enabled" && (w.events ?? []).includes("email.received"));
    const got = mine ? await resend.webhooks.get(mine.id) : null;
    if (got?.data) hook = { id: got.data.id, secret: got.data.signing_secret };
  }
  if (!hook) {
    const made = await resend.webhooks.create({ endpoint: INBOX_WEBHOOK_URL, events: ["email.received"] });
    if (made.error || !made.data) return { error: `Receiving is on, but the webhook couldn't be made: ${made.error?.message ?? "no answer"}` };
    hook = { id: made.data.id, secret: made.data.signing_secret };
  }
  await supabaseAdmin.from("email_inbox_settings").update({ webhook_id: hook.id, webhook_secret: hook.secret, updated_at: new Date().toISOString() }).eq("id", 1);

  const status = await receivingStatus();
  if (status.state === "on" && status.record) {
    // Also in the Vercel logs, so whoever adds it to Vercel DNS can copy it from there.
    console.info(`[email] Receiving on — add MX record: name "${status.record.name}" value "${status.record.value}" priority ${status.record.priority}`);
  }
  await audit({ actor_id: user.id, action: "EMAIL_RECEIVING_ON", target_table: "email_inbox_settings", new_data: { domain: EMAIL_DOMAIN, webhook: hook.id } });
  revalidatePath("/admin/email");
  return { ok: true, status };
}

/** "Check again" after adding the MX record: Resend re-checks DNS, then the inbox pulls anything new. */
export async function recheckReceiving() {
  await requireRole(["super_admin"]);
  const resend = resendClient();
  if (!resend) return { error: "No RESEND_API_KEY is set in Vercel" };
  const d = await findDomain();
  if (d.id) {
    await resend.domains.verify(d.id);
    await new Promise((r) => setTimeout(r, 2500)); // Resend checks DNS in the background
  }
  const sync = await syncInbox();
  revalidatePath("/admin/email");
  return { ok: true, status: await receivingStatus(), added: sync.added };
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
