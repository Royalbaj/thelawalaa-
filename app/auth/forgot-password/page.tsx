"use client";
import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { sendBackupEmail } from "@/lib/auth-backup-email";
import { requestPasswordReset } from "@/app/actions/auth";
import AuthShell from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setBusy(true);
    const r = await requestPasswordReset(email);
    if ("error" in r) { setBusy(false); return setError(r.error); }
    // Our email service couldn't send — Supabase sends its own reset email instead.
    if (r.fallback) {
      const backup = await sendBackupEmail("reset", email);
      if (!backup.ok) { setBusy(false); return setError(backup.message); }
    }
    setBusy(false);
    // Same answer whether or not the account exists — no way to fish for emails.
    setSentTo(email);
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="No problem — we'll email you a link to choose a new one.">
      {sentTo ? (
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-brand-orange"><MailCheck size={30} /></div>
          <h2 className="mt-4 font-display text-2xl font-bold text-brand-brown">Check your inbox</h2>
          <p className="mt-2 text-stone-600">If <b className="break-all">{sentTo}</b> has a Thelawalaa account, a reset link is on its way. It only works once and expires soon.</p>
          <Link href="/auth/login" className="btn-primary mt-6">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-brand-red">{error}</p>}
          <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" inputMode="email" className="input" /></div>
          <button disabled={busy} className="btn-primary w-full !py-3.5">{busy ? "Sending…" : "Send reset link"}</button>
          <p className="text-center text-sm text-stone-600">Remembered it? <Link href="/auth/login" className="font-bold text-brand-orange">Sign in</Link></p>
        </form>
      )}
    </AuthShell>
  );
}
