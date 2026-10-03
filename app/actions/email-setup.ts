"use server";

import { requireRole } from "@/lib/supabase/server";
import { audit, getRewardSettings } from "@/lib/supabase/admin";
import { resendClient, sendEmail, EMAIL_DOMAIN } from "@/lib/email";
import { supabaseTemplates, testEmail } from "@/lib/account-emails";

// Admin → Settings → Email setup. Everything that talks to Resend runs here
// on the server, so the API key never reaches a browser. Our emails come
// from hello@thelawalaa.com, which Resend only sends once thelawalaa.com is
// verified — i.e. its DNS records are added (in Vercel, which hosts the DNS).

export type DnsRecord = { record: string; type: string; name: string; value: string; status: string; priority?: number };
export type EmailSetup =
  | { state: "no_key" }
  | { state: "key_error"; error: string }
  | { state: "not_added"; otherDomains: string[] }
  | { state: "added"; id: string; status: string; region: string; records: DnsRecord[] };

async function load(): Promise<EmailSetup> {
  const resend = resendClient();
  if (!resend) return { state: "no_key" };
  const list = await resend.domains.list();
  if (list.error) return { state: "key_error", error: list.error.message };
  const domains = list.data?.data ?? [];
  const ours = domains.find((d) => d.name === EMAIL_DOMAIN);
  if (!ours) return { state: "not_added", otherDomains: domains.map((d) => d.name) };
  const got = await resend.domains.get(ours.id);
  if (got.error || !got.data) return { state: "key_error", error: got.error?.message ?? "Couldn't read the domain" };
  return {
    state: "added", id: ours.id, status: got.data.status, region: got.data.region,
    records: got.data.records
      .filter((r) => r.record === "SPF" || r.record === "DKIM")
      .map((r) => ({ record: r.record, type: r.type, name: r.name, value: r.value, status: r.status, priority: "priority" in r ? Number(r.priority) : undefined })),
  };
}

export async function getEmailSetup() {
  await requireRole(["super_admin"]);
  try { return await load(); } catch (e) { return { state: "key_error", error: e instanceof Error ? e.message : "Couldn't reach Resend" } as EmailSetup; }
}

/** Adds thelawalaa.com to the Resend account, which hands back the DNS records to add. */
export async function addEmailDomain() {
  const { user } = await requireRole(["super_admin"]);
  const resend = resendClient();
  if (!resend) return { error: "No RESEND_API_KEY is set in Vercel" };
  const { error } = await resend.domains.create({ name: EMAIL_DOMAIN, region: "us-east-1" });
  if (error && !/already/i.test(error.message)) return { error: error.message };
  await audit({ actor_id: user.id, action: "EMAIL_DOMAIN_ADD", target_table: "email", new_data: { domain: EMAIL_DOMAIN } });
  return { ok: true, setup: await load() };
}

/** "Check again" — asks Resend to look up the DNS records now. */
export async function recheckEmailDomain() {
  await requireRole(["super_admin"]);
  const resend = resendClient();
  if (!resend) return { error: "No RESEND_API_KEY is set in Vercel" };
  const before = await load();
  if (before.state !== "added") return { ok: true, setup: before };
  const { error } = await resend.domains.verify(before.id);
  if (error) return { error: error.message };
  await new Promise((r) => setTimeout(r, 2500)); // Resend checks DNS in the background
  return { ok: true, setup: await load() };
}

/** Send the branded test email to yourself and report exactly what Resend says. */
export async function sendTestEmail() {
  const { user, profile } = await requireRole(["super_admin"]);
  if (!user.email) return { error: "Your account has no email address" };
  const r = await sendEmail({ to: user.email, ...testEmail(profile.full_name) });
  return r.ok ? { ok: true, to: user.email } : { error: r.error };
}

/** Supabase's backup emails in our design, to paste into Supabase → Authentication → Email Templates. */
export async function getSupabaseEmailTemplates() {
  await requireRole(["super_admin"]);
  const rewards = await getRewardSettings();
  return supabaseTemplates(rewards.enabled ? rewards.welcome_points : 0);
}
