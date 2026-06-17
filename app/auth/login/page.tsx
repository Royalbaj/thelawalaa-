"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validations/auth";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin", pos_user: "/pos", delivery_driver: "/delivery", customer: "/account",
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error("Check your email and password");

    setBusy(true);
    const supabase = createClient();
    // Brute-force protection happens server-side: Supabase Auth rate-limits
    // sign-in attempts per IP. (Client-side lockouts are decorative.)
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error || !data.user) { setBusy(false); return toast.error("Wrong email or password"); }

    const { data: profile } = await supabase
      .from("profiles").select("role, is_active").eq("id", data.user.id).single();
    if (!profile?.is_active) { await supabase.auth.signOut(); setBusy(false); return router.push("/auth/suspended"); }

    const redirect = params.get("redirect");
    // Only allow same-site relative redirects — blocks open-redirect phishing
    const safe = redirect && redirect.startsWith("/") && !redirect.startsWith("//");
    router.push(profile.role === "customer" && safe ? redirect! : ROLE_HOME[profile.role] ?? "/account");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" /></div>
      <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" required className="input" /></div>
      <button disabled={busy} className="btn-primary w-full">{busy ? "Signing in…" : "Sign in"}</button>
      <div className="flex justify-between text-sm font-bold">
        <Link href="/auth/forgot-password" className="text-brand-orange">Forgot password?</Link>
        <Link href="/auth/signup" className="text-brand-green">New here? Sign up</Link>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
      <div className="card w-full max-w-md p-8">
        <p className="text-center font-display text-3xl font-bold brand-gradient-text">Thelawalaa</p>
        <h1 className="mt-2 text-center font-display text-xl font-bold">Welcome back</h1>
        <div className="mt-6"><Suspense><LoginForm /></Suspense></div>
      </div>
    </div>
  );
}
