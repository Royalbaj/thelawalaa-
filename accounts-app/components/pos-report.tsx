"use client";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { decideRequest, resolveIssue, reopenIssue } from "@/app/actions/pos";
import type { PosIssue, PosRequest } from "@/lib/pos";
import { ISSUE_KINDS, PAID_WITH, REQUEST_KINDS, npDayTime } from "@/lib/pos-outlet";
import { npr, cn } from "@/lib/utils";

/** What the counter asked for, in words the approver can check at a glance. */
export function requestText(r: Pick<PosRequest, "kind" | "payload">) {
  const p = r.payload;
  const qty = (n: unknown) => `${n} ${p.unit ?? ""}`.trim();
  switch (r.kind) {
    case "stock_waste": return `Take ${qty(p.quantity)} of ${p.item} off as waste`;
    case "stock_count": return `${p.item}: there is really ${qty(p.quantity)} (recount)`;
    case "stock_fix": return Number(p.quantity) === 0
      ? `${p.item}: the ${qty(p.old_quantity)} added on the POS never came — remove it`
      : `${p.item}: the POS add was ${qty(p.old_quantity)}, should be ${qty(p.quantity)}`;
    case "expense_remove": return `Remove the expense ${npr(Number(p.old_amount))} — "${p.old_reason}"`;
    case "expense_edit": {
      const parts = [
        p.amount !== undefined && `amount ${npr(Number(p.old_amount))} → ${npr(Number(p.amount))}`,
        p.reason !== undefined && `reason "${p.old_reason}" → "${p.reason}"`,
        p.category !== undefined && `kind ${p.old_category} → ${p.category}`,
        p.paid_with !== undefined && `paid with ${PAID_WITH[String(p.old_paid_with)] ?? p.old_paid_with} → ${PAID_WITH[String(p.paid_with)] ?? p.paid_with}`,
      ].filter(Boolean);
      return `Change the expense "${p.old_reason}": ${parts.join(", ")}`;
    }
    default: return REQUEST_KINDS[r.kind] ?? r.kind;
  }
}

export function RequestCard({ r }: { r: PosRequest }) {
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const decide = (approve: boolean) => start(async () => {
    const res = await decideRequest(r.id, approve, { note: note.trim() || undefined });
    if (res?.error) { toast.error(res.error); return; }
    toast.success(approve ? "Approved — it's changed" : "Not approved — nothing changed");
  });
  return (
    <li className="card space-y-2 p-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-brand-orange">{REQUEST_KINDS[r.kind] ?? r.kind}</p>
        <p className="font-bold text-stone-800">{requestText(r)}</p>
        <p className="text-sm text-stone-600">&ldquo;{r.reason}&rdquo;</p>
        <p className="text-xs text-stone-400">Asked by {r.personName} on the POS · {npDayTime(r.createdAt)}</p>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder="Note back (optional)" aria-label="Note back" className="input !py-2 text-base sm:text-sm" />
      <div className="flex gap-2">
        <button onClick={() => decide(true)} disabled={pending} className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60">Approve</button>
        <button onClick={() => decide(false)} disabled={pending} className="flex-1 rounded-xl bg-white py-2.5 text-sm font-bold text-brand-red ring-1 ring-red-200 transition hover:bg-red-50 disabled:opacity-60">Don&apos;t approve</button>
      </div>
    </li>
  );
}

export function IssueCard({ i }: { i: PosIssue }) {
  const [closing, setClosing] = useState(false);
  const [resolution, setResolution] = useState("");
  const [pending, start] = useTransition();
  const resolve = () => start(async () => {
    const r = await resolveIssue(i.id, { resolution: resolution.trim() || undefined });
    if (r?.error) { toast.error(r.error); return; }
    toast.success("Marked as sorted — the POS shows it"); setClosing(false);
  });
  const reopen = () => start(async () => { const r = await reopenIssue(i.id); r?.error ? toast.error(r.error) : toast.success("Open again"); });
  const sorted = !!i.resolvedAt;
  return (
    <li className={cn("card p-4", i.urgent && !sorted && "ring-2 ring-red-200", sorted && "opacity-80")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-bold text-stone-800">
            {sorted ? <CheckCircle2 size={15} className="shrink-0 text-green-600" /> : i.urgent && <AlertTriangle size={15} className="shrink-0 text-brand-red" />}
            {i.title}
          </p>
          {i.details && <p className="mt-0.5 whitespace-pre-line text-sm text-stone-600">{i.details}</p>}
          <p className="mt-1 text-xs text-stone-400">{ISSUE_KINDS[i.kind] ?? i.kind}{i.urgent ? " · urgent" : ""} · {i.personName} · {npDayTime(i.createdAt)}</p>
          {sorted && <p className="mt-1 text-xs text-green-700">Sorted by {i.resolvedBy} · {npDayTime(i.resolvedAt!)}{i.resolution ? ` — ${i.resolution}` : ""}</p>}
        </div>
        {sorted
          ? <button onClick={reopen} disabled={pending} className="shrink-0 text-xs font-bold text-stone-500 hover:text-brand-orange">Reopen</button>
          : !closing && <button onClick={() => setClosing(true)} className="shrink-0 rounded-full bg-green-600 px-3 py-1.5 text-xs font-bold text-white">Mark sorted</button>}
      </div>
      {closing && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input value={resolution} onChange={(e) => setResolution(e.target.value.slice(0, 300))} placeholder="What was done? (optional)" aria-label="What was done"
            className="input min-w-0 flex-1 !py-2 text-base sm:text-sm" />
          <button onClick={resolve} disabled={pending} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Save</button>
          <button onClick={() => setClosing(false)} aria-label="Cancel" className="p-2 text-stone-400"><X size={16} /></button>
        </div>
      )}
    </li>
  );
}
