"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");
    if (!email || !password) return toast.error("Enter your email and password");

    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) { setBusy(false); return toast.error("Wrong email or password"); }

    const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", data.user.id).single();
    if (!profile?.is_active || !["super_admin", "accountant"].includes(profile.role)) {
      await supabase.auth.signOut({ scope: "local" });
      setBusy(false);
      return toast.error("This account can't access Accounts");
    }
    // Full page load, replacing this page in history — see components/shell.tsx.
    window.location.replace("/");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {params.get("from") === "main" && (
        <p className="rounded-xl bg-orange-50 px-4 py-2.5 text-sm font-bold text-brand-brown">
          Accounts has its own sign-in — use the same email and password here. Bookmark this page for next time.
        </p>
      )}
      {params.get("error") === "forbidden" && (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-brand-red">That account can&apos;t access Accounts.</p>
      )}
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" /></div>
      <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required className="input" /></div>
      <button disabled={busy} className="btn-primary w-full">{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
      <div className="card w-full max-w-md p-8">
        <p className="text-center font-display text-3xl font-bold brand-gradient-text">Thelawalaa</p>
        <h1 className="mt-2 text-center font-display text-lg font-bold text-brand-brown">Accounts</h1>
        <div className="mt-6"><Suspense><LoginForm /></Suspense></div>
      </div>
    </div>
  );
}
