"use client";
import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { signupSchema } from "@/lib/validations/auth";

function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

export default function SignupPage() {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const s = strength(pw);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    if (fd.password !== fd.confirm) return toast.error("Passwords don't match");
    const parsed = signupSchema.safeParse(fd);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setBusy(true);
    const supabase = createClient();
    // SECURITY: role is NOT in metadata. The DB trigger only reads role
    // from app_metadata (service-role only), so self-signup is always 'customer'.
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.full_name, phone: parsed.data.phone },
        emailRedirectTo: `${window.location.origin}/auth/verify`,
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
  }

  if (sent)
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
        <div className="card max-w-md p-8 text-center">
          <p className="text-5xl">📬</p>
          <h1 className="mt-3 font-display text-2xl font-bold">Check your email</h1>
          <p className="mt-2 text-stone-600">Tap the verification link we just sent to activate your account.</p>
        </div>
      </div>
    );

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4 py-10">
      <div className="card w-full max-w-md p-8">
        <p className="text-center font-display text-3xl font-bold brand-gradient-text">Thelawalaa</p>
        <h1 className="mt-2 text-center font-display text-xl font-bold">Create your account</h1>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div><label className="label" htmlFor="full_name">Full name</label><input id="full_name" name="full_name" required minLength={2} maxLength={100} className="input" /></div>
          <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required className="input" /></div>
          <div><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" required placeholder="98XXXXXXXX" className="input" /></div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required className="input" value={pw} onChange={(e) => setPw(e.target.value)} />
            <div className="mt-2 flex gap-1" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`h-1.5 flex-1 rounded-full ${i < s ? ["bg-brand-red","bg-brand-yellow","bg-brand-orange","bg-brand-green"][s - 1] : "bg-stone-200"}`} />
              ))}
            </div>
            <p className="mt-1 text-xs text-stone-500">8+ characters with an uppercase letter, a number and a symbol.</p>
          </div>
          <div><label className="label" htmlFor="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" required className="input" /></div>
          <button disabled={busy} className="btn-primary w-full">{busy ? "Creating…" : "Create account"}</button>
          <p className="text-center text-sm font-bold">Already a member? <Link href="/auth/login" className="text-brand-orange">Sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
