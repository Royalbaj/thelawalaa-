"use client";
import { useState } from "react";
import Link from "next/link";
import { sendBackupEmail } from "@/lib/auth-backup-email";
import { signupSchema } from "@/lib/validations/auth";
import { signUpCustomer } from "@/app/actions/auth";
import PasswordInput from "@/components/auth/password-input";
import CheckInbox from "@/components/auth/check-inbox";

/** Customer sign-up (website and the QR poster): the server creates the account and sends our own confirmation email. */
export default function SignupForm({ source = "web", afterSent }: { source?: "web" | "qr_poster"; afterSent?: React.ReactNode }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    fd.phone = (fd.phone ?? "").replace(/[\s-]/g, ""); // "98 1234 5678" is fine too
    // Top to bottom, like the form: say what's wrong and put the cursor there.
    const fail = (field: string, message: string) => { setError(message); document.getElementById(field)?.focus(); };
    const parsed = signupSchema.safeParse(fd);
    if (!parsed.success) return fail(String(parsed.error.issues[0].path[0] ?? ""), parsed.error.issues[0].message);
    if (fd.password !== fd.confirm) return fail("confirm", "The two passwords don't match");

    setBusy(true);
    const r = await signUpCustomer({ ...parsed.data, source });
    if ("error" in r) { setBusy(false); return setError(r.error); }
    // Our email service couldn't send — Supabase sends its own confirmation instead.
    if (r.fallback) {
      const backup = await sendBackupEmail("signup", parsed.data.email);
      if (!backup.ok) { setBusy(false); return setError(backup.message); }
    }
    setBusy(false);
    setSentTo(parsed.data.email.toLowerCase());
  }

  if (sentTo) return <CheckInbox email={sentTo}>{afterSent}</CheckInbox>;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-brand-red">{error}</p>}
      <div><label className="label" htmlFor="full_name">Full name</label><input id="full_name" name="full_name" required minLength={2} maxLength={100} autoComplete="name" className="input" /></div>
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" inputMode="email" className="input" /></div>
      <div><label className="label" htmlFor="phone">Mobile number</label><input id="phone" name="phone" required placeholder="98XXXXXXXX" autoComplete="tel" inputMode="tel" className="input" /></div>
      <PasswordInput id="password" name="password" label="Password" value={pw} onChange={setPw} showRules autoComplete="new-password" />
      <PasswordInput id="confirm" name="confirm" label="Confirm password" autoComplete="new-password" />
      <button disabled={busy} className="btn-primary w-full !py-3.5">{busy ? "Creating your account…" : "Create account"}</button>
      <p className="text-center text-xs text-stone-400">By creating an account you agree to receive order updates by email. We never share your details.</p>
      <p className="text-center text-sm text-stone-600">Already have an account? <Link href="/auth/login" className="font-bold text-brand-orange">Sign in</Link></p>
    </form>
  );
}
