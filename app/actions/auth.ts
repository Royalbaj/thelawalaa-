"use server";

import { z } from "zod";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { getVerifiedUser } from "@/lib/supabase/server";
import { supabaseAdmin, audit, getRewardSettings } from "@/lib/supabase/admin";
import { signupSchema } from "@/lib/validations/auth";
import { sendEmail, EMAIL_SITE, emailRecentlyWorking } from "@/lib/email";
import { verifyEmail, welcomeEmail, resetEmail, alreadyRegisteredEmail } from "@/lib/account-emails";

// Customer accounts, done on the server so the emails are ours (branded,
// from "Thelawalaa", via Resend) instead of Supabase's plain, rate-limited
// ones. Links in them open /auth/confirm, where the one-time token is only
// used when the person taps the button — so inbox link-scanners can't burn it.
//
// Nothing here ever signs anyone in: confirming an email only confirms it.
// People are signed in only when they type their password on /auth/login —
// the shop's phones and tablets are shared, so a link must never leave one
// "logged in" as whoever opened it.
//
// None of these say whether an email already has an account. If Resend
// can't send, `fallback: true` tells the page to ask Supabase to send its
// own (plain) email instead, so nobody is ever stuck without one.

type Result = { ok: true; fallback?: boolean } | { error: string };
const emailSchema = z.string().trim().toLowerCase().email().max(254);

function keyHash(value: string) {
  const secret = process.env.OTP_HMAC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "local-dev";
  return createHmac("sha256", `auth-email|${secret}`).update(value).digest("hex").slice(0, 32);
}

/** At most `max` of this kind of email per key per hour (the IP and the address are each a key). */
async function throttled(kind: string, keys: string[], max: number) {
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  for (const key of keys) {
    const { count } = await supabaseAdmin.from("email_throttle").select("id", { count: "exact", head: true })
      .eq("kind", kind).eq("key_hash", keyHash(key)).gte("created_at", since);
    if ((count ?? 0) >= max) return true;
  }
  await supabaseAdmin.from("email_throttle").insert(keys.map((k) => ({ kind, key_hash: keyHash(k) })));
  return false;
}
const clientIp = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

async function accountStatus(email: string) {
  const { data } = await supabaseAdmin.rpc("auth_user_status", { p_email: email });
  return (Array.isArray(data) ? data[0] : data) as { id: string; confirmed: boolean; full_name: string | null; role: string | null } | undefined;
}

/** A one-time link that signs them in (and confirms the address) when they tap "Confirm" on /auth/confirm. */
async function sendVerification(email: string, name: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) return false;
  const url = `${EMAIL_SITE}/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`;
  const rewards = await getRewardSettings();
  const mail = verifyEmail(name, url, rewards.enabled ? rewards.welcome_points : 0);
  return (await sendEmail({ to: email, ...mail })).ok;
}

export async function signUpCustomer(input: unknown): Promise<Result> {
  const parsed = signupSchema.extend({
    email: emailSchema,
    source: z.enum(["web", "qr_poster"]).optional(),
  }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form" };
  const d = parsed.data;
  if (await throttled("signup", [await clientIp(), d.email], 5)) return { error: "Too many attempts — please wait a few minutes and try again" };

  const existing = await accountStatus(d.email);
  if (existing?.confirmed) {
    // Don't reveal it here; tell the owner by email instead. The answer looks
    // like a new sign-up's (the page's backup send just does nothing here).
    const sent = await sendEmail({ to: d.email, ...alreadyRegisteredEmail(existing.full_name ?? d.full_name) });
    return { ok: true, fallback: !sent.ok };
  }
  if (!existing) {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: d.email, password: d.password, email_confirm: false,
      user_metadata: { full_name: d.full_name, phone: d.phone },
    });
    if (error || !created.user) return { error: "Couldn't create your account — please try again" };
    await supabaseAdmin.from("profiles").update({ signup_source: d.source ?? "web" }).eq("id", created.user.id);
    await audit({ actor_id: created.user.id, action: "CUSTOMER_SIGNUP", target_table: "profiles", target_id: created.user.id, new_data: { source: d.source ?? "web" } });
  }
  const sent = await sendVerification(d.email, existing?.full_name ?? d.full_name);
  return { ok: true, fallback: !sent };
}

export async function resendVerification(email: unknown): Promise<Result> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { error: "Enter a valid email" };
  if (await throttled("verify", [await clientIp(), parsed.data], 4)) return { error: "We've sent a few already — please wait a few minutes" };
  const existing = await accountStatus(parsed.data);
  // No such (unconfirmed) account: answer exactly as if there were one.
  if (!existing || existing.confirmed) return { ok: true, fallback: !emailRecentlyWorking() };
  const sent = await sendVerification(parsed.data, existing.full_name ?? "");
  return { ok: true, fallback: !sent };
}

export async function requestPasswordReset(email: unknown): Promise<Result> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { error: "Enter a valid email" };
  if (await throttled("reset", [await clientIp(), parsed.data], 4)) return { error: "We've sent a few already — please wait a few minutes" };
  const existing = await accountStatus(parsed.data);
  // No account: answer exactly as if there were one, so nobody can fish for emails.
  if (!existing) return { ok: true, fallback: !emailRecentlyWorking() };
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email: parsed.data });
  if (error || !data?.properties?.hashed_token) return { ok: true, fallback: true };
  const url = `${EMAIL_SITE}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery`;
  const sent = await sendEmail({ to: parsed.data, ...resetEmail(existing.full_name ?? "", url) });
  return { ok: true, fallback: !sent.ok };
}

/** The welcome email, at most once per customer (welcomed_at is claimed atomically). */
async function welcomeOnce(userId: string, email: string | undefined, fullName: string) {
  const { data: claimed } = await supabaseAdmin.from("profiles")
    .update({ welcomed_at: new Date().toISOString() }).eq("id", userId).is("welcomed_at", null).select("id");
  if (!claimed?.length || !email) return false;
  const [rewards, { data: bal }] = await Promise.all([
    getRewardSettings(),
    supabaseAdmin.from("loyalty_points").select("points").eq("customer_id", userId).maybeSingle(),
  ]);
  const { data: freeItem } = rewards.free_item_product_id
    ? await supabaseAdmin.from("products").select("name").eq("id", rewards.free_item_product_id).maybeSingle()
    : { data: null };
  await sendEmail({ to: email, ...welcomeEmail(fullName, rewards, freeItem?.name ?? null, bal?.points ?? 0) });
  return true;
}

/**
 * "Confirm my email" on /auth/confirm. The token is checked here on the
 * server with a throwaway client, and the session that check creates is
 * revoked straight away — so no cookie ever reaches the device. They then
 * sign in themselves.
 */
export async function confirmEmail(tokenHash: unknown, kind: unknown = "magiclink"): Promise<{ ok: true } | { error: string }> {
  const parsed = z.string().min(10).max(200).regex(/^[A-Za-z0-9_-]+$/).safeParse(tokenHash);
  if (!parsed.success) return { error: "expired" };
  // "magiclink": our own email; "email": Supabase's backup confirmation (Supabase template).
  const type = kind === "email" ? "email" : "magiclink";
  const plain = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await plain.auth.verifyOtp({ token_hash: parsed.data, type });
  if (error || !data.user) return { error: "expired" };
  if (data.session) await supabaseAdmin.auth.admin.signOut(data.session.access_token, "local").catch(() => null);

  const u = data.user;
  if (!u.email_confirmed_at) await supabaseAdmin.auth.admin.updateUserById(u.id, { email_confirm: true });
  const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, role").eq("id", u.id).single();
  if (profile?.role === "customer") await welcomeOnce(u.id, u.email, profile.full_name);
  await audit({ actor_id: u.id, action: "EMAIL_CONFIRMED", target_table: "profiles", target_id: u.id });
  return { ok: true };
}

/**
 * After a customer signs in on /auth/login (or Supabase's backup email
 * confirmed them): make sure the address is marked confirmed and send the
 * welcome email if it hasn't gone yet.
 */
export async function completeSignup(): Promise<{ welcomed: boolean }> {
  const { user, profile } = await getVerifiedUser();
  if (!user || !profile || profile.role !== "customer") return { welcomed: false };
  // Signed in at all means Supabase accepted the address (or its backup email link did).
  if (!user.email_confirmed_at) await supabaseAdmin.auth.admin.updateUserById(user.id, { email_confirm: true });
  return { welcomed: await welcomeOnce(user.id, user.email, profile.full_name) };
}
