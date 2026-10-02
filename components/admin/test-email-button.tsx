"use client";
import { useState, useTransition } from "react";
import { Mail, CheckCircle2, AlertTriangle } from "lucide-react";
import { sendTestEmail } from "@/app/actions/rewards";

/** Sends the branded test email to the signed-in admin and shows exactly what came back. */
export default function TestEmailButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: true; to: string } | { error: string } | null>(null);
  return (
    <div className="card p-5">
      <h3 className="flex items-center gap-2 font-display font-bold text-brand-brown"><Mail size={18} /> Customer emails</h3>
      <p className="mt-1 text-xs text-stone-500">Sign-up, welcome, password-reset and order emails go out from &quot;Thelawalaa&quot; with the logo. Send one to yourself to check they arrive.</p>
      <button type="button" disabled={pending} onClick={() => start(async () => {
        const r = await sendTestEmail();
        setResult("error" in r ? { error: r.error ?? "Couldn't send" } : { ok: true, to: r.to! });
      })} className="btn-primary mt-3 w-full !py-2.5 text-sm">{pending ? "Sending…" : "Send a test email to me"}</button>
      {result && "ok" in result && (
        <p className="mt-3 flex gap-2 rounded-xl bg-green-50 p-3 text-xs text-green-800"><CheckCircle2 size={16} className="shrink-0" /> Sent to {result.to}. Not in your inbox in a minute? Check spam.</p>
      )}
      {result && "error" in result && (
        <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-800">
          <p className="flex gap-2 font-bold"><AlertTriangle size={16} className="shrink-0" /> Not sent</p>
          <p className="mt-1">Resend said: <span className="font-mono">{result.error}</span></p>
          <p className="mt-1 text-red-700">Customers still get Supabase&apos;s plain backup emails meanwhile. Usually this means thelawalaa.com isn&apos;t verified in Resend yet, or the API key is wrong.</p>
        </div>
      )}
    </div>
  );
}
