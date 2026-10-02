"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resendVerification } from "@/app/actions/auth";

/** After sign-up: where the email went, a way to open it, and a resend with a cooldown. */
export default function CheckInbox({ email, children }: { email: string; children?: React.ReactNode }) {
  const [wait, setWait] = useState(60);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function resend() {
    setBusy(true);
    const r = await resendVerification(email);
    if ("error" in r) { setBusy(false); return toast.error(r.error); }
    if (r.fallback) await createClient().auth.resend({ type: "signup", email, options: { emailRedirectTo: `${window.location.origin}/auth/verify` } });
    setBusy(false);
    setWait(60);
    toast.success("Sent again — check your inbox");
  }

  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-brand-orange"><MailCheck size={30} /></div>
      <h2 className="mt-4 font-display text-2xl font-bold text-brand-brown">Check your inbox</h2>
      <p className="mt-2 text-stone-600">We sent a confirmation link to <b className="break-all text-stone-800">{email}</b>. Tap it to activate your account.</p>
      <div className="mt-6 flex flex-col gap-3">
        {/@gmail\.com$/i.test(email) && (
          <a href="https://mail.google.com/mail/u/0/#search/from%3Athelawalaa" target="_blank" rel="noopener noreferrer" className="btn-primary">Open Gmail</a>
        )}
        <button onClick={resend} disabled={busy || wait > 0} className="rounded-full border-2 border-stone-200 px-6 py-3 font-bold text-brand-brown transition hover:bg-stone-50 disabled:opacity-50">
          {wait > 0 ? `Resend in ${wait}s` : busy ? "Sending…" : "Resend the email"}
        </button>
      </div>
      <p className="mt-4 text-xs text-stone-400">Not there? Check Spam or Promotions. The link only works once.</p>
      {children}
    </div>
  );
}
