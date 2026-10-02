"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { passwordSchema } from "@/lib/validations/auth";
import AuthShell from "@/components/auth/auth-shell";
import PasswordInput from "@/components/auth/password-input";

// Reached signed-in from a reset link: /auth/confirm (our email) or Supabase's
// backup email (?code=…, which the browser client exchanges on load).
export default function ResetPasswordPage() {
  const [ready, setReady] = useState<"checking" | "yes" | "no">("checking");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let done = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session && !done) { done = true; setReady("yes"); }
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) { done = true; setReady("yes"); } });
    const t = setTimeout(() => { if (!done) setReady("no"); }, 4000);
    return () => { subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    if (fd.password !== fd.confirm) return setError("The two passwords don't match");
    const parsed = passwordSchema.safeParse(fd.password);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password: parsed.data });
    if (err) { setBusy(false); return setError(/different from the old/i.test(err.message) ? "Choose a password you haven't used before" : "Couldn't save it — request a new link and try again"); }
    // The reset link's session was only for saving the password: end it here,
    // so they sign in themselves with the new one (shared devices stay logged out).
    await supabase.auth.signOut({ scope: "local" }).catch(() => null);
    toast.success("Password updated");
    window.location.replace("/auth/login?reset=1");
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Pick something you don't use anywhere else.">
      {ready === "no" ? (
        <div className="text-center">
          <p className="text-stone-600">This reset link has expired or was already used.</p>
          <Link href="/auth/forgot-password" className="btn-primary mt-6">Send a new link</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-brand-red">{error}</p>}
          <PasswordInput id="password" name="password" label="New password" value={pw} onChange={setPw} showRules autoComplete="new-password" />
          <PasswordInput id="confirm" name="confirm" label="Confirm new password" autoComplete="new-password" />
          <button disabled={busy || ready !== "yes"} className="btn-primary w-full !py-3.5">{ready === "checking" ? "Checking your link…" : busy ? "Saving…" : "Save new password"}</button>
        </form>
      )}
    </AuthShell>
  );
}
