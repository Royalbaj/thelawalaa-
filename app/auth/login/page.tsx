"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { MailWarning, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validations/auth";
import { ROLE_HOME } from "@/lib/role-home";
import { completeSignup, resendVerification } from "@/app/actions/auth";
import { sendBackupEmail } from "@/lib/auth-backup-email";
import AuthShell from "@/components/auth/auth-shell";
import PasswordInput from "@/components/auth/password-input";
import SignedInNotice from "@/components/auth/signed-in-notice";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setUnverified(null);
    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return setError("Enter your email and password");

    setBusy(true);
    const supabase = createClient();
    // Brute-force protection happens server-side: Supabase Auth rate-limits
    // sign-in attempts per IP. (Client-side lockouts are decorative.)
    const { data, error: signInError } = await supabase.auth.signInWithPassword(parsed.data);
    if (signInError || !data.user) {
      setBusy(false);
      if (signInError?.code === "email_not_confirmed" || /not confirmed/i.test(signInError?.message ?? "")) {
        setUnverified(parsed.data.email);
        return;
      }
      return setError("Wrong email or password");
    }

    const { data: profile } = await supabase
      .from("profiles").select("role, is_active").eq("id", data.user.id).single();
    if (!profile?.is_active) { await supabase.auth.signOut({ scope: "local" }); setBusy(false); return router.push("/auth/suspended"); }
    // Accounts logins only work on accounts.thelawalaa.com. Here they get the same
    // answer as a wrong password — nothing says an Accounts login exists.
    if (profile.role === "accountant") {
      await supabase.auth.signOut({ scope: "local" });
      setBusy(false);
      return setError("Wrong email or password");
    }
    // Welcome email, if confirming didn't already send it (e.g. Supabase's backup email).
    if (profile.role === "customer") await completeSignup().catch(() => null);

    const redirect = params.get("redirect");
    // Only allow same-site relative redirects — blocks open-redirect phishing
    const safe = redirect && redirect.startsWith("/") && !redirect.startsWith("//");
    // First sign-in straight after confirming: the account home with its welcome note.
    const home = profile.role === "customer" && params.get("verified") === "1" ? "/account?welcome=1" : ROLE_HOME[profile.role] ?? "/account";
    // A full page load, replacing this login page in history: it drops Next's
    // in-memory copy of whatever the previous user had open on this device,
    // so pressing Back can't show their screens.
    window.location.replace(profile.role === "customer" && safe ? redirect! : home);
  }

  async function resend() {
    if (!unverified) return;
    setBusy(true);
    const r = await resendVerification(unverified);
    if ("error" in r) { setBusy(false); return toast.error(r.error); }
    if (r.fallback) {
      const backup = await sendBackupEmail("signup", unverified);
      if (!backup.ok) { setBusy(false); return toast.error(backup.message); }
    }
    setBusy(false);
    toast.success("Sent — check your inbox (and spam folder)");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {(params.get("verified") === "1" || params.get("reset") === "1") && !error && !unverified && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm font-bold text-green-800">
          <CheckCircle2 size={18} className="mt-px shrink-0" />
          {params.get("reset") === "1" ? "Password changed — sign in with your new password." : "Email confirmed — sign in to start ordering."}
        </p>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-brand-red">{error}</p>}
      {unverified && (
        <div role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <p className="flex items-center gap-2 font-bold"><MailWarning size={16} /> Please confirm your email first</p>
          <p className="mt-1">We sent a link to <b>{unverified}</b> when you signed up. Can&apos;t find it?</p>
          <button type="button" onClick={resend} disabled={busy} className="mt-3 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50">
            Send me a new link
          </button>
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" className="input" />
      </div>
      <PasswordInput id="password" name="password" label="Password" />
      <div className="flex justify-end">
        <Link href="/auth/forgot-password" className="text-sm font-bold text-brand-orange">Forgot password?</Link>
      </div>
      <button disabled={busy} className="btn-primary w-full !py-3.5">{busy ? "Signing in…" : "Sign in"}</button>
      <p className="pt-2 text-center text-sm text-stone-600">
        New to Thelawalaa? <Link href="/auth/signup" className="font-bold text-brand-orange">Create an account</Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to order faster, track your food and collect rewards.">
      <SignedInNotice purpose="login" />
      <Suspense><LoginForm /></Suspense>
    </AuthShell>
  );
}
