import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resendClient, EMAIL_DOMAIN, EMAIL_SITE } from "@/lib/email";

// Admin → Email → Inbox. Resend receives every email sent to an
// @thelawalaa.com address (once receiving is on and the MX record is in
// Vercel DNS) and tells us through a webhook; we copy each one into
// `inbox_emails`. Opening the inbox also pulls anything the webhook missed.
// Nothing here trusts a webhook body: we always fetch the email from Resend's
// API by its id, so a forged call can't put anything in the inbox.

/** Where Resend posts "email.received". */
export const INBOX_WEBHOOK_URL = `${EMAIL_SITE}/api/email/received`;
const FROM_ADDRESS = `hello@${EMAIL_DOMAIN}`;
/** Bigger bodies (photos pasted into the email) aren't kept — they're fetched from Resend when opened. */
const KEEP_HTML = 1_000_000;

export type InboxAttachment = { id: string; filename: string | null; content_type: string; size: number; inline: boolean };
export type InboxRow = {
  id: string; resend_id: string; from_email: string; from_name: string | null; to_emails: string[]; cc: string[];
  reply_to: string | null; subject: string; snippet: string | null; text_body: string | null; html_body: string | null; message_id: string | null;
  attachments: InboxAttachment[]; received_at: string; read_at: string | null; replied_at: string | null;
  archived_at: string | null; forwarded_to: string | null;
};

/** `Sita Tamang <sita@x.com>` → { email, name }. */
export function parseAddress(raw: string) {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(raw ?? "");
  return m ? { email: m[2].trim().toLowerCase(), name: m[1].trim() || null } : { email: (raw ?? "").trim().toLowerCase(), name: null };
}

export async function inboxSettings() {
  const { data } = await supabaseAdmin.from("email_inbox_settings").select("webhook_id, webhook_secret, forward_to").eq("id", 1).maybeSingle();
  return data ?? { webhook_id: null as string | null, webhook_secret: null as string | null, forward_to: null as string | null };
}

/** The first words of what they wrote — quoted earlier emails ("> …", "On … wrote:") left out. */
function snippetOf(text: string | null, html: string | null) {
  const plain = text ?? (html ?? "").replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  const lines: string[] = [];
  for (const line of plain.split(/\r?\n/)) {
    if (/^\s*>/.test(line)) continue;
    if (/^\s*On .{4,200}wrote:\s*$/i.test(line) || /^-{2,}\s*Original Message/i.test(line)) break;
    lines.push(line);
  }
  return lines.join(" ").replace(/\s+/g, " ").trim().slice(0, 200) || null;
}

/** Copies one received email from Resend into the inbox. `isNew` is true only for the call that saved it. */
export async function saveReceived(resendId: string): Promise<{ row?: InboxRow; isNew: boolean; error?: string }> {
  const resend = resendClient();
  if (!resend) return { isNew: false, error: "No RESEND_API_KEY" };
  const { data: have } = await supabaseAdmin.from("inbox_emails").select("id").eq("resend_id", resendId).maybeSingle();
  if (have) return { isNew: false };

  const { data: mail, error } = await resend.emails.receiving.get(resendId);
  if (error || !mail) return { isNew: false, error: error?.message ?? "Not found in Resend" };
  const from = parseAddress(mail.from);
  const replyTo = mail.reply_to?.[0] ? parseAddress(mail.reply_to[0]).email : null;
  // The webhook and a sync can arrive together: the unique resend_id lets only one of them save it.
  const { data: rows } = await supabaseAdmin.from("inbox_emails").upsert({
    resend_id: mail.id,
    from_email: from.email || "unknown",
    from_name: from.name?.slice(0, 200) ?? null,
    to_emails: (mail.to ?? []).slice(0, 50),
    cc: (mail.cc ?? []).slice(0, 50),
    reply_to: replyTo && replyTo !== from.email ? replyTo : null,
    subject: (mail.subject ?? "").slice(0, 500),
    snippet: snippetOf(mail.text, mail.html),
    text_body: mail.text ? mail.text.slice(0, 200_000) : null,
    html_body: mail.html && mail.html.length <= KEEP_HTML ? mail.html : null,
    message_id: mail.message_id ?? null,
    attachments: (mail.attachments ?? []).slice(0, 50).map((a) => ({
      id: a.id, filename: a.filename, content_type: a.content_type, size: a.size,
      // Pictures inside the email body are already in its HTML.
      inline: a.content_disposition === "inline" && !!a.content_id,
    })),
    received_at: mail.created_at,
  }, { onConflict: "resend_id", ignoreDuplicates: true }).select("*");
  const row = rows?.[0] as InboxRow | undefined;
  return { row, isNew: !!row };
}

/** Pulls anything Resend received that isn't in the inbox yet (the webhook's safety net). */
export async function syncInbox(): Promise<{ added: number; error?: string }> {
  const resend = resendClient();
  if (!resend) return { added: 0, error: "No RESEND_API_KEY" };
  const { data, error } = await resend.emails.receiving.list({ limit: 50 });
  if (error || !data) return { added: 0, error: error?.message ?? "Couldn't reach Resend" };
  const ids = data.data.map((e) => e.id);
  if (!ids.length) return { added: 0 };
  const { data: have } = await supabaseAdmin.from("inbox_emails").select("resend_id").in("resend_id", ids);
  const known = new Set((have ?? []).map((h) => h.resend_id));
  let added = 0;
  for (const id of ids.filter((i) => !known.has(i)).slice(0, 15)) {
    if ((await saveReceived(id)).isNew) added++;
  }
  return { added };
}

/** The email's body — kept here, or fetched from Resend when it was too big to keep. */
export async function inboxBody(row: Pick<InboxRow, "resend_id" | "html_body" | "text_body">) {
  if (row.html_body || !resendClient()) return { html: row.html_body, text: row.text_body };
  const { data } = await resendClient()!.emails.receiving.get(row.resend_id);
  return { html: data?.html ?? null, text: data?.text ?? row.text_body };
}

/** A short download link for one attachment (Resend keeps the files). */
export async function attachmentLink(resendId: string, attachmentId: string) {
  const { data } = await resendClient()?.emails.receiving.attachments.get({ emailId: resendId, id: attachmentId }) ?? { data: null };
  return data?.download_url ?? null;
}

/**
 * Sends a copy to `to` (Admin → Email → Inbox "Also send to"): from
 * "<sender> via Thelawalaa", reply-to the person who wrote, so answering the
 * copy from a phone's mail app goes straight back to them.
 */
export async function forwardReceived(row: InboxRow, to: string) {
  const resend = resendClient();
  if (!resend) return { error: "No RESEND_API_KEY" };
  const body = await inboxBody(row);
  const files = row.attachments.filter((a) => !a.inline).slice(0, 10);
  const links = files.length ? (await resend.emails.receiving.attachments.list({ emailId: row.resend_id })).data?.data ?? [] : [];
  const sender = (row.from_name || row.from_email).replace(/["<>,;\\]/g, "").slice(0, 60);
  const { error } = await resend.emails.send({
    from: `${sender} via Thelawalaa <${FROM_ADDRESS}>`,
    to,
    replyTo: row.reply_to || row.from_email,
    subject: row.subject || "(no subject)",
    ...(body.html ? { html: body.html } : {}),
    text: body.text || `${row.from_email} sent an email to Thelawalaa. Open Admin → Email → Inbox to read it: ${EMAIL_SITE}/admin/email`,
    attachments: links.filter((l) => files.some((f) => f.id === l.id))
      .map((l) => ({ path: l.download_url, filename: l.filename ?? "attachment", contentType: l.content_type })),
  });
  if (error) { console.error("[email] Inbox forward failed:", error.message); return { error: error.message }; }
  await supabaseAdmin.from("inbox_emails").update({ forwarded_to: to }).eq("id", row.id);
  return { ok: true };
}

// ── Turning receiving on ────────────────────────────────────────────────

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

/** Where receiving stands: switched on in Resend, the MX record's DNS check, the webhook. Callers check the role. */
export async function getReceivingStatus(): Promise<ReceivingStatus> {
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

/**
 * Switches receiving on for the domain in Resend and makes sure the
 * "email.received" webhook exists (reusing one already pointing at us), with
 * its signing secret saved. Safe to run again — it repairs a missing webhook.
 */
export async function turnOnReceiving(): Promise<{ error: string } | { ok: true; webhookId: string; status: ReceivingStatus }> {
  const resend = resendClient();
  if (!resend) return { error: "No RESEND_API_KEY is set in Vercel" };
  const d = await findDomain();
  if (d.error) return { error: d.error };
  if (!d.id) return { error: `${EMAIL_DOMAIN} isn't in Resend yet — add it in Admin → Settings → Email setup first` };

  const upd = await resend.domains.update({ id: d.id, capabilities: { receiving: "enabled" } });
  if (upd.error) return { error: upd.error.message };

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

  const status = await getReceivingStatus();
  if (status.state === "on" && status.record) {
    // Also in the Vercel logs, so whoever adds it to Vercel DNS can copy it from there.
    console.info(`[email] Receiving on — add MX record: name "${status.record.name}" value "${status.record.value}" priority ${status.record.priority}`);
  }
  return { ok: true, webhookId: hook.id, status };
}

/** Asks Resend to look up the DNS records again (after adding the MX record). */
export async function recheckDomain() {
  const d = resendClient() ? await findDomain() : { id: null };
  if (d.id) {
    await resendClient()!.domains.verify(d.id);
    await new Promise((r) => setTimeout(r, 2500)); // Resend checks DNS in the background
  }
}
