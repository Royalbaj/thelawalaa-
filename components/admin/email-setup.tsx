"use client";
import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Mail, CheckCircle2, AlertTriangle, Clock, Copy, RefreshCw, ChevronDown } from "lucide-react";
import { getEmailSetup, addEmailDomain, recheckEmailDomain, sendTestEmail, getSupabaseEmailTemplates, type EmailSetup } from "@/app/actions/email-setup";
import { cn } from "@/lib/utils";

const copy = async (text: string, what: string) => {
  try { await navigator.clipboard.writeText(text); toast.success(`${what} copied`); } catch { toast.error("Couldn't copy — select it and copy by hand"); }
};

function CopyCell({ value, what }: { value: string; what: string }) {
  return (
    <button type="button" onClick={() => copy(value, what)} title="Copy"
      className="group flex w-full min-w-0 items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 text-left font-mono text-[11px] ring-1 ring-stone-200 hover:ring-brand-orange">
      <span className="min-w-0 flex-1 break-all">{value}</span>
      <Copy size={12} className="shrink-0 text-stone-400 group-hover:text-brand-orange" />
    </button>
  );
}

/**
 * Admin → Settings: is customer email working? Shows Resend's view of
 * thelawalaa.com, the DNS records still to add (in Vercel), a test send,
 * and Supabase's backup templates in our design.
 */
export default function EmailSetupPanel({ initial }: { initial?: EmailSetup }) {
  const [setup, setSetup] = useState<EmailSetup | null>(initial ?? null);
  const [pending, start] = useTransition();
  const [test, setTest] = useState<{ ok: true; to: string } | { error: string } | null>(null);
  const [tplOpen, setTplOpen] = useState(false);
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof getSupabaseEmailTemplates>> | null>(null);

  useEffect(() => {
    if (initial) return;
    getEmailSetup().then(setSetup).catch(() => setSetup({ state: "key_error", error: "Couldn't check — refresh the page" }));
  }, [initial]);

  const verified = setup?.state === "added" && setup.status === "verified";
  const badge = !setup ? null : verified
    ? <span className="badge gap-1 bg-green-100 text-green-800"><CheckCircle2 size={12} /> Working</span>
    : setup.state === "added"
      ? <span className="badge gap-1 bg-amber-100 text-amber-800"><Clock size={12} /> Waiting for DNS</span>
      : <span className="badge gap-1 bg-red-100 text-red-800"><AlertTriangle size={12} /> Not set up</span>;

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-display font-bold text-brand-brown"><Mail size={18} /> Customer emails</h3>
          <p className="mt-0.5 text-xs text-stone-500">Sign-up, welcome, password-reset, order and staff-invite emails, sent as <b>Thelawalaa &lt;hello@thelawalaa.com&gt;</b> with the logo.</p>
        </div>
        <span className="shrink-0 whitespace-nowrap">{badge}</span>
      </div>

      {!setup && <p className="text-sm text-stone-400">Checking with the email service…</p>}

      {setup?.state === "no_key" && (
        <p className="rounded-xl bg-red-50 p-3 text-xs text-red-800">No Resend API key is set in Vercel (RESEND_API_KEY), so only Supabase&apos;s plain backup emails go out.</p>
      )}

      {setup?.state === "key_error" && (
        <div className="rounded-xl bg-red-50 p-3 text-xs text-red-800">
          <p className="font-bold">Resend said: <span className="font-mono">{setup.error}</span></p>
          <p className="mt-1">If the key is &quot;sending only&quot;, open resend.com → Domains → Add domain → <b>thelawalaa.com</b>, then add the records it shows in Vercel (Domains → thelawalaa.com → DNS Records).</p>
        </div>
      )}

      {setup?.state === "not_added" && (
        <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
          <p><b>thelawalaa.com isn&apos;t set up for sending yet</b>, so customers get Supabase&apos;s plain backup emails instead of ours.</p>
          {setup.otherDomains.length > 0 && <p>Domains in this Resend account: {setup.otherDomains.join(", ")}.</p>}
          <button disabled={pending} onClick={() => start(async () => {
            const r = await addEmailDomain();
            if ("error" in r) toast.error(r.error ?? "Couldn't add it"); else { setSetup(r.setup); toast.success("Added — now add the DNS records below"); }
          })} className="btn-primary w-full !py-2 text-sm">{pending ? "Setting up…" : "Set up thelawalaa.com for sending"}</button>
        </div>
      )}

      {setup?.state === "added" && !verified && (
        <div className="space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-xs text-stone-600">
            <li>Open <a href="https://vercel.com/dashboard/domains" target="_blank" rel="noopener noreferrer" className="font-bold text-brand-orange">Vercel → Domains</a> → <b>thelawalaa.com</b> → DNS Records (your domain&apos;s DNS lives in Vercel).</li>
            <li>Add each record below exactly — tap a value to copy it.</li>
            <li>Come back and tap <b>Check again</b>. It usually takes a few minutes.</li>
          </ol>
          <div className="space-y-2">
            {setup.records.map((r, i) => (
              <div key={i} className="space-y-1.5 rounded-xl bg-stone-50 p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-700">{r.type}{r.priority != null ? ` · priority ${r.priority}` : ""} <span className="font-normal text-stone-400">({r.record})</span></span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold",
                    r.status === "verified" ? "bg-green-100 text-green-800" : r.status === "failed" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800")}>{r.status.replace("_", " ")}</span>
                </div>
                <div className="grid grid-cols-[3.5rem_1fr] items-center gap-1.5 text-[11px] text-stone-500">
                  <span>Name</span><CopyCell value={r.name} what="Name" />
                  <span>Value</span><CopyCell value={r.value} what="Value" />
                </div>
              </div>
            ))}
          </div>
          <button disabled={pending} onClick={() => start(async () => {
            const r = await recheckEmailDomain();
            if ("error" in r) toast.error(r.error ?? "Couldn't check"); else {
              setSetup(r.setup);
              toast(r.setup.state === "added" && r.setup.status === "verified" ? "Verified — branded emails are on" : "Not yet — DNS can take a few minutes", { icon: r.setup.state === "added" && r.setup.status === "verified" ? "✅" : "⏳" });
            }
          })} className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-stone-200 py-2 text-sm font-bold text-brand-brown hover:bg-stone-50">
            <RefreshCw size={14} className={cn(pending && "animate-spin")} /> Check again
          </button>
        </div>
      )}

      {verified && <p className="rounded-xl bg-green-50 p-3 text-xs text-green-800">thelawalaa.com is verified — customers get the branded emails. Send yourself a test to see one.</p>}

      <div className="border-t border-stone-100 pt-3">
        <button type="button" disabled={pending} onClick={() => start(async () => {
          const r = await sendTestEmail();
          setTest("error" in r ? { error: r.error ?? "Couldn't send" } : { ok: true, to: r.to! });
        })} className="btn-primary w-full !py-2.5 text-sm">{pending ? "Working…" : "Send a test email to me"}</button>
        {test && "ok" in test && <p className="mt-2 flex gap-2 rounded-xl bg-green-50 p-3 text-xs text-green-800"><CheckCircle2 size={16} className="shrink-0" /> Sent to {test.to}. Not in your inbox in a minute? Check spam.</p>}
        {test && "error" in test && <p className="mt-2 rounded-xl bg-red-50 p-3 text-xs text-red-800"><b>Not sent.</b> Resend said: <span className="font-mono">{test.error}</span></p>}
      </div>

      {/* Supabase's backup emails — used only when ours can't be sent */}
      <div className="border-t border-stone-100 pt-3">
        <button type="button" onClick={() => {
          setTplOpen((v) => !v);
          if (!templates) getSupabaseEmailTemplates().then(setTemplates).catch(() => toast.error("Couldn't load the templates"));
        }} className="flex w-full items-center justify-between text-left text-sm font-bold text-brand-brown">
          Backup emails (Supabase) in the same design
          <ChevronDown size={16} className={cn("transition", tplOpen && "rotate-180")} />
        </button>
        {tplOpen && (
          <div className="mt-3 space-y-3 text-xs text-stone-600">
            <p>If our email can&apos;t be sent, Supabase sends its own plain one from &quot;Supabase Auth&quot;. To make those look like ours too:</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Supabase → <b>Authentication → Emails → SMTP Settings</b> → turn on custom SMTP: host <b>smtp.resend.com</b>, port <b>465</b>, username <b>resend</b>, password = your Resend API key, sender <b>hello@thelawalaa.com</b>, sender name <b>Thelawalaa</b>. (Needs thelawalaa.com verified above.)</li>
              <li>Supabase → <b>Authentication → Emails → Templates</b>: for each template below, paste the subject and the body.</li>
            </ol>
            {!templates && <p className="text-stone-400">Loading…</p>}
            {templates?.map((t) => (
              <div key={t.key} className="rounded-xl bg-stone-50 p-3">
                <p className="font-bold text-stone-700">{t.label}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => copy(t.subject, "Subject")} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white py-1.5 font-bold ring-1 ring-stone-200 hover:ring-brand-orange"><Copy size={12} /> Subject</button>
                  <button type="button" onClick={() => copy(t.html, "Email body")} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white py-1.5 font-bold ring-1 ring-stone-200 hover:ring-brand-orange"><Copy size={12} /> Body (HTML)</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
