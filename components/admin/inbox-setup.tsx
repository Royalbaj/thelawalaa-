"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Check, Copy, RefreshCw } from "lucide-react";
import { connectInbox, forwardWaiting, recheckReceiving, setInboxForward, type ReceivingStatus } from "@/app/actions/inbox";
import { cn } from "@/lib/utils";

function CopyValue({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}
      className="ml-2 inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-1 text-[11px] font-bold text-stone-600 hover:bg-stone-200">
      {done ? <Check size={12} /> : <Copy size={12} />} {done ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * Receiving email at @thelawalaa.com. Until it's all connected (receiving on,
 * webhook made, a Gmail to copy everything to) the one thing shown is "Get
 * every email in your Gmail"; then the MX record if DNS hasn't confirmed it
 * yet; once working, a single line.
 */
export function InboxSetup({ status, forwardTo }: { status: ReceivingStatus; forwardTo: string | null }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [gmail, setGmail] = useState(forwardTo ?? "");
  const run = (fn: () => Promise<{ error?: string; ok?: boolean; added?: number }>, done?: (r: { added?: number }) => void) =>
    start(async () => {
      const r = await fn();
      if (r.error) { toast.error(r.error); return; }
      done?.(r);
      router.refresh();
    });

  if (status.state === "no_key") return <Notice tone="red">Email isn&apos;t set up — there&apos;s no Resend key in Vercel.</Notice>;
  if (status.state === "no_domain") return <Notice tone="red">thelawalaa.com isn&apos;t in Resend yet. Add it in Admin → Settings → Email setup first.</Notice>;
  if (status.state === "error") return <Notice tone="red">Couldn&apos;t reach Resend: {status.error}</Notice>;

  const connected = status.state === "on" && status.webhook && !!forwardTo;
  const record = status.state === "on" ? status.record : null;
  const dnsOk = record?.status === "verified";

  if (!connected) {
    return (
      <section className="card border-l-4 border-l-brand-red p-5">
        <h2 className="font-bold text-stone-900">Get every email in your Gmail</h2>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          Every email sent to any @thelawalaa.com address — admin@, hello@, orders@, anything — will arrive here <b>and</b> in this
          Gmail. Answering it from Gmail goes straight back to the person who wrote.
        </p>
        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await connectInbox({ to: gmail });
            if (r.error) { toast.error(r.error); return; }
            toast.success(r.forwarded ? `Turned on — ${r.forwarded} email${r.forwarded === 1 ? "" : "s"} already received sent to ${gmail.trim()}` : `Turned on — new email will reach ${gmail.trim()}`);
            router.refresh();
          });
        }}>
          <label className="min-w-[14rem] flex-1">
            <span className="label">Your Gmail</span>
            <input value={gmail} onChange={(e) => setGmail(e.target.value)} type="email" inputMode="email" required autoComplete="email"
              placeholder="yourname@gmail.com" className="input text-sm" />
          </label>
          <button type="submit" disabled={busy} className="btn-primary px-6 py-2.5 text-sm">{busy ? "Turning on…" : "Turn on"}</button>
        </form>
      </section>
    );
  }

  if (!dnsOk) {
    return (
      <section className="card border-l-4 border-l-amber-400 p-5">
        <h2 className="font-bold text-stone-900">Almost there — the DNS record</h2>
        {record ? (
          <>
            <p className="mt-1 max-w-2xl text-sm text-stone-600">
              Resend hasn&apos;t confirmed this record yet. It must be in Vercel → Domains → thelawalaa.com → DNS Records; then press
              <b> Check again</b> (DNS can take a few minutes).
            </p>
            <dl className="mt-3 grid gap-2 rounded-xl bg-stone-50 p-3 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="font-bold text-stone-500">Type</dt><dd className="font-mono">MX</dd>
              <dt className="font-bold text-stone-500">Name</dt><dd className="font-mono">{record.name || "@"} <span className="font-sans text-xs text-stone-400">(&ldquo;@&rdquo; or blank = thelawalaa.com itself)</span></dd>
              <dt className="font-bold text-stone-500">Value</dt><dd className="break-all font-mono">{record.value}<CopyValue value={record.value} /></dd>
              <dt className="font-bold text-stone-500">Priority</dt><dd className="font-mono">{record.priority}</dd>
              <dt className="font-bold text-stone-500">Status</dt><dd className="font-bold text-amber-700">Not confirmed yet</dd>
            </dl>
          </>
        ) : (
          <p className="mt-1 text-sm text-stone-600">Resend hasn&apos;t given the record yet — press Check again in a moment.</p>
        )}
        <button type="button" disabled={busy} onClick={() => run(recheckReceiving)} className="btn-primary mt-4 px-5 py-2.5 text-sm">{busy ? "Checking…" : "Check again"}</button>
      </section>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <p className="flex items-center gap-2 font-bold text-green-700">
        <span className="h-2 w-2 rounded-full bg-green-500" /> Receiving every @thelawalaa.com email — copies go to {forwardTo}
      </p>
      <button type="button" disabled={busy} onClick={() => run(recheckReceiving, (r) => toast.success(r.added ? `${r.added} new` : "Nothing new"))}
        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-stone-600 shadow-sm ring-1 ring-stone-200 hover:text-brand-orange disabled:opacity-50">
        <RefreshCw size={13} className={cn(busy && "animate-spin")} /> Check for new email
      </button>
    </div>
  );
}

function Notice({ tone, children }: { tone: "red"; children: React.ReactNode }) {
  return <p className={cn("rounded-xl px-4 py-3 text-sm font-bold", tone === "red" && "bg-red-50 text-brand-red")}>{children}</p>;
}

/** Change (or clear) the Gmail that every new email is copied to — reply-to the sender, so it can be answered from a phone. */
export function InboxForward({ current, waiting }: { current: string | null; waiting: number }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [busy, start] = useTransition();
  const changed = value.trim().toLowerCase() !== (current ?? "");
  return (
    <div className="space-y-3">
      {current && waiting > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm ring-1 ring-amber-100">
          <p className="font-bold text-amber-900">{waiting} email{waiting === 1 ? " here hasn't" : "s here haven't"} gone to {current} yet</p>
          <button type="button" disabled={busy} className="btn-primary px-4 py-2 text-sm" onClick={() => start(async () => {
            const r = await forwardWaiting();
            if (r.error) { toast.error(r.error); return; }
            toast.success(`Sent ${r.forwarded} to ${current}`);
            router.refresh();
          })}>{busy ? "Sending…" : "Send them to Gmail"}</button>
        </div>
      )}
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await setInboxForward({ to: value });
          if (r.error) { toast.error(r.error); return; }
          toast.success(value.trim() ? `New email will also go to ${value.trim()}` : "Copies switched off");
          router.refresh();
        });
      }}>
        <label className="min-w-[14rem] flex-1">
          <span className="label">Send a copy of every new email to</span>
          <input value={value} onChange={(e) => setValue(e.target.value)} type="email" inputMode="email" placeholder="yourname@gmail.com" className="input text-sm" />
        </label>
        <button type="submit" disabled={busy || !changed} className="btn-primary px-5 py-2.5 text-sm">{busy ? "Saving…" : "Save"}</button>
      </form>
    </div>
  );
}
