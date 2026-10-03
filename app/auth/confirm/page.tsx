"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, KeyRound, XCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { confirmEmail } from "@/app/actions/auth";
import AuthShell from "@/components/auth/auth-shell";

// Links in OUR emails (verify + password reset) open this page. The one-time
// token is only used when the person taps the button — never on page load —
// so an inbox security scanner that opens every link can't burn it first.
// Confirming an email never signs anyone in (it's checked on the server and
// no session reaches this device) — they sign in themselves afterwards.
function Confirm() {
  const params = useSearchParams();
  const tokenHash = params.get("token_hash");
  // recovery = password reset; email/signup = Supabase's backup confirmation; magiclink = ours.
  const raw = params.get("type");
  const type = raw === "recovery" ? "recovery" : raw === "email" || raw === "signup" ? "email" : "magiclink";
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(!tokenHash);
  const [confirmed, setConfirmed] = useState(false);

  async function go() {
    if (!tokenHash) return;
    setBusy(true);
    if (type === "recovery") {
      // A reset needs a session to save the new password; /auth/reset-password signs it out again after.
      const { error } = await createClient().auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) { setBusy(false); setFailed(true); return; }
      return window.location.replace("/auth/reset-password");
    }
    const r = await confirmEmail(tokenHash, type).catch(() => ({ error: "expired" }));
    setBusy(false);
    if ("error" in r) return setFailed(true);
    setConfirmed(true);
  }

  if (confirmed) {
    return (
      <div className="text-center">
        <CheckCircle2 size={48} className="mx-auto text-brand-green" />
        <h2 className="mt-3 font-display text-2xl font-bold text-brand-brown">Email confirmed</h2>
        <p className="mt-2 text-stone-600">Your account is ready, and we&apos;ve sent you a welcome email. Sign in with your email and password to start ordering.</p>
        <Link href="/auth/login?verified=1" className="btn-primary mt-6 w-full !py-3.5">Sign in</Link>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="text-center">
        <XCircle size={44} className="mx-auto text-brand-red" />
        <h2 className="mt-3 font-display text-2xl font-bold text-brand-brown">This link has expired</h2>
        <p className="mt-2 text-stone-600">Links only work once and for a short time. Get a fresh one below.</p>
        <div className="mt-6 flex flex-col gap-3">
          {type === "recovery"
            ? <Link href="/auth/forgot-password" className="btn-primary">Send a new reset link</Link>
            : <Link href="/auth/login" className="btn-primary">Sign in to get a new link</Link>}
          <Link href="/" className="font-bold text-stone-500">Back to the website</Link>
        </div>
      </div>
    );
  }
  const Icon = type === "recovery" ? KeyRound : ShieldCheck;
  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-brand-orange"><Icon size={30} /></div>
      <p className="mt-4 text-stone-600">
        {type === "recovery" ? "Tap below to choose a new password for your account." : "One last tap and your account is ready."}
      </p>
      <button onClick={go} disabled={busy} className="btn-primary mt-6 w-full !py-3.5">
        {busy ? "Just a moment…" : type === "recovery" ? "Choose a new password" : "Confirm my email"}
      </button>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <AuthShell title="Almost there">
      <Suspense><Confirm /></Suspense>
    </AuthShell>
  );
}
