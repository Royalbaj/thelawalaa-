"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Check, Copy, RefreshCw } from "lucide-react";
import { enableReceiving, recheckReceiving, setInboxForward, type ReceivingStatus } from "@/app/actions/inbox";
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
 * Receiving email at @thelawalaa.com: off → "Turn on receiving"; on but the
 * MX record isn't in DNS yet → the one record to add + "Check again";
 * working → a single line and "Check for new email".
 */
export function InboxSetup({ status }: { status: ReceivingStatus }) {
  const router = useRouter();
  const [busy, start] = useTransition();
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

  if (status.state === "off") {
    return (
      <section className="card border-l-4 border-l-brand-red p-5">
        <h2 className="font-bold text-stone-900">Replies can&apos;t reach you yet</h2>
        <p className="mt-1 max-w-2xl text-sm text-stone-600">
          Nothing receives email for thelawalaa.com, so when someone answers an email from us (to admin@, hello@ or any
          @thelawalaa.com address) their mail app says <b>&ldquo;not delivered&rdquo;</b>. Turn on receiving and replies will arrive here.
        </p>
        <button type="button" disabled={busy} onClick={() => run(enableReceiving, () => toast.success("Receiving is on — now add the record below to the DNS"))}
          className="btn-primary mt-4 px-5 py-2.5 text-sm">{busy ? "Turning on…" : "Turn on receiving"}</button>
      </section>
    );
  }

  const live = status.record?.status === "verified" && status.webhook;
  if (live) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="flex items-center gap-2 font-bold text-green-700"><span className="h-2 w-2 rounded-full bg-green-500" /> Receiving email for every @thelawalaa.com address</p>
        <button type="button" disabled={busy} onClick={() => run(recheckReceiving, (r) => toast.success(r.added ? `${r.added} new` : "Nothing new"))}
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-stone-600 shadow-sm ring-1 ring-stone-200 hover:text-brand-orange disabled:opacity-50">
          <RefreshCw size={13} className={cn(busy && "animate-spin")} /> Check for new email
        </button>
      </div>
    );
  }

  return (
    <section className="card border-l-4 border-l-amber-400 p-5">
      <h2 className="font-bold text-stone-900">Almost there — add one DNS record</h2>
      {!status.webhook && (
        <p className="mt-1 text-sm text-brand-red">The webhook that tells us about new email is missing — press &ldquo;Turn on receiving&rdquo; again.</p>
      )}
      {status.record ? (
        <>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">
            In Vercel → Domains → thelawalaa.com → DNS Records, add this record. Then press <b>Check again</b> (DNS can take a few minutes).
          </p>
          <dl className="mt-3 grid gap-2 rounded-xl bg-stone-50 p-3 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="font-bold text-stone-500">Type</dt><dd className="font-mono">MX</dd>
            <dt className="font-bold text-stone-500">Name</dt><dd className="font-mono">{status.record.name || "@"} <span className="font-sans text-xs text-stone-400">(&ldquo;@&rdquo; or blank = thelawalaa.com itself)</span></dd>
            <dt className="font-bold text-stone-500">Value</dt><dd className="break-all font-mono">{status.record.value}<CopyValue value={status.record.value} /></dd>
            <dt className="font-bold text-stone-500">Priority</dt><dd className="font-mono">{status.record.priority}</dd>
            <dt className="font-bold text-stone-500">Status</dt><dd className={cn("font-bold", status.record.status === "verified" ? "text-green-700" : "text-amber-700")}>{status.record.status === "verified" ? "Found" : "Not found yet"}</dd>
          </dl>
        </>
      ) : (
        <p className="mt-1 text-sm text-stone-600">Resend hasn&apos;t given the record yet — press Check again in a moment.</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => run(recheckReceiving)} className="btn-primary px-5 py-2.5 text-sm">{busy ? "Checking…" : "Check again"}</button>
        {!status.webhook && (
          <button type="button" disabled={busy} onClick={() => run(enableReceiving)} className="rounded-full bg-stone-100 px-5 py-2.5 text-sm font-bold text-stone-700">Turn on receiving</button>
        )}
      </div>
    </section>
  );
}

function Notice({ tone, children }: { tone: "red"; children: React.ReactNode }) {
  return <p className={cn("rounded-xl px-4 py-3 text-sm font-bold", tone === "red" && "bg-red-50 text-brand-red")}>{children}</p>;
}

/** "Also send a copy to …" — each new email is copied there, reply-to the sender, so it can be answered from a phone. */
export function InboxForward({ current }: { current: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [busy, start] = useTransition();
  const changed = value.trim().toLowerCase() !== (current ?? "");
  return (
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
        <span className="label">Also send a copy of each new email to <span className="font-normal text-stone-400">(optional)</span></span>
        <input value={value} onChange={(e) => setValue(e.target.value)} type="email" inputMode="email" placeholder="yourname@gmail.com" className="input text-sm" />
      </label>
      <button type="submit" disabled={busy || !changed} className="btn-primary px-5 py-2.5 text-sm">{busy ? "Saving…" : "Save"}</button>
    </form>
  );
}
