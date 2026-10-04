"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, X, Layers } from "lucide-react";
import { saveMarketingActivity, setActivityStatus, deleteMarketingActivity } from "@/app/actions/marketing";
import { CATEGORIES, CATEGORY_SHORT, pct, times, type Category } from "@/lib/marketing-shared";
import type { Activity } from "@/lib/marketing";
import { npr, cn } from "@/lib/utils";
import { nepalTodayYmd } from "./entries";

const STATUS_LABEL = { active: "Running", paused: "Paused", ended: "Done" } as const;
const STATUS_TINT = { active: "bg-green-100 text-green-800", paused: "bg-amber-100 text-amber-800", ended: "bg-stone-200 text-stone-600" } as const;

function ActivityForm({ initial, onClose }: { initial?: Activity; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<Category>(initial?.category ?? "printing");
  const [budget, setBudget] = useState(initial?.budget != null ? String(initial.budget) : "");
  const [startsOn, setStartsOn] = useState(initial?.starts_on ?? nepalTodayYmd());
  const [endsOn, setEndsOn] = useState(initial?.ends_on ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={initial ? "Edit activity" : "New activity"}>
      <form className="max-h-[92dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveMarketingActivity(initial?.id ?? null, { name, category, budget: budget ? Number(budget) : null, starts_on: startsOn, ends_on: endsOn || null, notes });
          if ("error" in r && r.error) { toast.error(r.error); return; }
          toast.success(initial ? "Saved" : "Activity added — link expenses and returns to it");
          router.refresh();
          onClose();
        });
      }}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-brand-brown">{initial ? "Edit activity" : "New activity"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        <div><label className="label" htmlFor="a-name">Name</label>
          <input id="a-name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Membership cards, Dashain stall, School sponsorship…" required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="a-cat">Category</label>
            <select id="a-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div><label className="label" htmlFor="a-budget">Budget (Rs)</label>
            <input id="a-budget" className="input" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Optional" /></div>
          <div><label className="label" htmlFor="a-start">Starts</label>
            <input id="a-start" type="date" className="input !px-2" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required /></div>
          <div><label className="label" htmlFor="a-end">Ends</label>
            <input id="a-end" type="date" className="input !px-2" value={endsOn} min={startsOn} onChange={(e) => setEndsOn(e.target.value)} /></div>
        </div>
        <div><label className="label" htmlFor="a-notes">Notes</label>
          <textarea id="a-notes" className="input" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <button disabled={pending || name.trim().length < 2} className="btn-primary w-full">{pending ? "Saving…" : initial ? "Save" : "Add activity"}</button>
      </form>
    </div>
  );
}

export function NewActivityButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-brand-brown ring-1 ring-stone-200 hover:bg-stone-50"><Plus size={14} /> New activity</button>
      {open && <ActivityForm onClose={() => setOpen(false)} />}
    </>
  );
}

function ActivityRow({ a }: { a: Activity }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const over = a.budgetUse != null && a.budgetUse > 1;
  return (
    <li className={cn("rounded-2xl p-4 ring-1 ring-stone-100", a.status === "ended" && "opacity-75")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-brand-brown">{a.name}</p>
          <p className="text-xs text-stone-500">{CATEGORY_SHORT[a.category]} · from {a.starts_on}{a.ends_on ? ` to ${a.ends_on}` : ""}</p>
        </div>
        <select aria-label="Status" disabled={pending} value={a.status}
          onChange={(e) => start(async () => { await setActivityStatus(a.id, e.target.value as Activity["status"]); router.refresh(); })}
          className={cn("shrink-0 rounded-full border-0 py-1 pl-2.5 pr-7 text-[11px] font-bold", STATUS_TINT[a.status])}>
          {(Object.keys(STATUS_LABEL) as Activity["status"][]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-orange-50 py-2"><p className="text-[10px] font-bold uppercase text-orange-700/70">Spent</p><p className="font-display font-extrabold text-brand-brown">{npr(a.spent)}</p></div>
        <div className="rounded-xl bg-blue-50 py-2"><p className="text-[10px] font-bold uppercase text-blue-700/70">Returns</p><p className="font-display font-extrabold text-blue-900">{npr(a.returns)}</p></div>
        <div className={cn("rounded-xl py-2", a.r.roi == null ? "bg-stone-50" : a.r.roi >= 0 ? "bg-green-50" : "bg-red-50")}>
          <p className="text-[10px] font-bold uppercase text-stone-500">ROI</p>
          <p className={cn("font-display font-extrabold", a.r.roi == null ? "text-stone-400" : a.r.roi >= 0 ? "text-green-700" : "text-brand-red")}>{pct(a.r.roi)}</p>
        </div>
      </div>
      {a.budget != null && (
        <div className="mt-2">
          <div className="flex justify-between text-[11px] font-bold text-stone-500"><span>Budget {npr(a.budget)}</span><span className={cn(over && "text-brand-red")}>{pct(a.budgetUse)} used · {npr(Math.max(0, a.budget - a.spent))} left</span></div>
          <div className="mt-1 h-2 rounded-full bg-stone-100"><div className={cn("h-2 rounded-full", over ? "bg-brand-red" : (a.budgetUse ?? 0) > 0.8 ? "bg-amber-500" : "bg-brand-orange")} style={{ width: `${Math.min(100, Math.max(2, (a.budgetUse ?? 0) * 100))}%` }} /></div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500">
        <span>Net <b className={cn(a.r.net >= 0 ? "text-green-700" : "text-brand-red")}>{a.r.net >= 0 ? "+" : "−"}{npr(Math.abs(a.r.net))}</b></span>
        <span>Back per Rs 1 <b className="text-stone-700">{times(a.r.perRupee)}</b></span>
        {a.newCustomers > 0 && <span>New customers <b className="text-stone-700">{a.newCustomers}</b></span>}
        <span className="ml-auto flex gap-1">
          <button onClick={() => setEditing(true)} aria-label="Edit activity" className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"><Pencil size={14} /></button>
          <button disabled={pending} aria-label="Delete activity" onClick={() => {
            if (confirm(`Delete “${a.name}”? Its expenses and returns stay, just without the activity name.`)) start(async () => { await deleteMarketingActivity(a.id); router.refresh(); });
          }} className="rounded-full p-1.5 text-stone-300 hover:bg-red-50 hover:text-brand-red"><Trash2 size={14} /></button>
        </span>
      </div>
      {a.notes && <p className="mt-1 text-xs text-stone-500">{a.notes}</p>}
      {editing && <ActivityForm initial={a} onClose={() => setEditing(false)} />}
    </li>
  );
}

export function ActivityList({ activities }: { activities: Activity[] }) {
  const live = activities.filter((a) => a.status !== "ended");
  const done = activities.filter((a) => a.status === "ended");
  if (!activities.length) {
    return (
      <div className="py-8 text-center text-sm text-stone-500">
        <Layers size={26} className="mx-auto mb-2 text-stone-300" />
        Group expenses and returns under an activity — e.g. &ldquo;Membership cards&rdquo; or &ldquo;Dashain stall&rdquo; — to see each one&apos;s ROI.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <ul className="grid gap-3 xl:grid-cols-2">{live.map((a) => <ActivityRow key={a.id} a={a} />)}</ul>
      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-bold text-stone-500">Done ({done.length})</summary>
          <ul className="mt-3 grid gap-3 xl:grid-cols-2">{done.map((a) => <ActivityRow key={a.id} a={a} />)}</ul>
        </details>
      )}
    </div>
  );
}
