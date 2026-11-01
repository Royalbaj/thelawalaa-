"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { NotebookPen, X, RefreshCw, Camera, AlertTriangle, CheckCircle2, Clock, Paperclip } from "lucide-react";
import { getOutletDay, addPosExpense, createPosBillUpload, requestExpenseChange, addPosStock, requestStockChange, addIssue } from "@/app/actions/outlet";
import { getPosStock } from "@/app/actions/pos";
import { createClient } from "@/lib/supabase/client";
import { EXPENSE_CATEGORIES, PAID_WITH, ISSUE_KINDS, type PaidWith, type IssueKind } from "@/lib/pos-outlet";
import type { PosFeature } from "@/lib/pos-features";
import type { PosStock, StockLevel } from "@/lib/stock-alerts";
import type { OutletExpense, OutletRequest } from "@/lib/outlet";
import { npTime, npDayMonthTime } from "@/lib/nepal-time";
import { npr, cn } from "@/lib/utils";

// The outlet's own records at the POS (migration 051) — for roles with the
// outlet tools (Admin → POS team & roles): day expenses, adding stock, asking
// for stock/expense fixes (an Accounts person approves) and issues & notes.
// Everything shows in the Accounts app's POS section.

type Day = Exclude<Awaited<ReturnType<typeof getOutletDay>>, { error: string }>;
type Tab = "expenses" | "stock" | "issues";

const muted = "text-stone-500 dark:text-stone-400";
const card = "rounded-2xl bg-white p-4 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800";
const field = "input !text-base dark:!border-stone-700 dark:!bg-stone-800 dark:!text-stone-100";
const chip = (on: boolean) => cn("touch-manipulation rounded-full px-3 py-2 text-sm font-bold ring-1 transition",
  on ? "bg-brand-orange text-white ring-brand-orange" : "bg-white text-stone-600 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700");
const num = (v: string) => v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 10);

/** POS header → "Outlet". */
export default function OutletButton({ features }: { features: PosFeature[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Outlet — expenses, stock, issues" title="Outlet · expenses, stock, issues"
        className="flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-2.5 text-xs font-bold text-white/80 transition hover:bg-white/20 hover:text-white">
        <NotebookPen size={15} /> <span className="hidden sm:inline">Outlet</span>
      </button>
      {open && <OutletSheet features={features} onClose={() => setOpen(false)} />}
    </>
  );
}

function OutletSheet({ features, onClose }: { features: PosFeature[]; onClose: () => void }) {
  const tabs = ([
    ["expenses", "Expenses", features.includes("expenses")],
    ["stock", "Stock", features.includes("stock_add") || features.includes("stock_edit")],
    ["issues", "Issues & notes", features.includes("issues")],
  ] as const).filter(([, , on]) => on);
  const [tab, setTab] = useState<Tab>(tabs[0]?.[0] ?? "expenses");
  const [day, setDay] = useState<Day | null>(null);
  const [stock, setStock] = useState<PosStock | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, start] = useTransition();
  const load = useCallback(() => start(async () => {
    try {
      const [d, s] = await Promise.all([getOutletDay(), getPosStock()]);
      if ("error" in d) { setFailed(true); toast.error(d.error ?? "Couldn't load"); return; }
      setDay(d); setStock(s); setFailed(false);
    } catch { setFailed(true); }
  }), []);
  useEffect(load, [load]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/60 lg:items-center lg:p-6" role="dialog" aria-modal="true" aria-label="Outlet">
      <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-brand-cream text-stone-900 [&_input]:select-text [&_textarea]:select-text dark:bg-stone-950 dark:text-stone-100 lg:h-[90dvh] lg:rounded-3xl lg:shadow-2xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900">
          <div className="min-w-0">
            <p className="font-display text-lg font-extrabold text-brand-brown dark:text-orange-100">Outlet</p>
            <p className={cn("text-xs", muted)}>Today&apos;s expenses, stock and notes — the manager sees them in Accounts → POS</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} aria-label="Refresh" className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800"><RefreshCw size={16} className={cn(loading && "animate-spin")} /></button>
            <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800"><X size={18} /></button>
          </div>
        </div>
        {tabs.length > 1 && (
          <div className="flex shrink-0 gap-1 border-b border-stone-200 bg-white px-3 dark:border-stone-800 dark:bg-stone-900">
            {tabs.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
                className={cn("touch-manipulation border-b-2 px-3 py-2.5 text-sm font-bold transition", tab === k ? "border-brand-orange text-brand-orange" : "border-transparent text-stone-500 dark:text-stone-400")}>
                {label}
              </button>
            ))}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
          {failed && <p className="mb-3 rounded-2xl bg-red-50 p-4 text-sm font-bold text-brand-red dark:bg-red-950/40">Couldn&apos;t load — check the connection and tap refresh.</p>}
          {!day ? <p className={cn("py-12 text-center text-sm", muted)}>Loading…</p> : (
            <>
              {tab === "expenses" && <ExpensesTab day={day} onSaved={load} />}
              {tab === "stock" && <StockTab day={day} stock={stock} canAdd={features.includes("stock_add")} canFix={features.includes("stock_edit")} onSaved={load} />}
              {tab === "issues" && <IssuesTab day={day} onSaved={load} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Expenses ─────────────────────────────────────────────────────
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)); // a bill stays readable
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo"))), "image/jpeg", 0.85));
}

function ExpensesTab({ day, onSaved }: { day: Day; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<string>("");
  const [paidWith, setPaidWith] = useState<PaidWith>("till_cash");
  const [bill, setBill] = useState<File | null>(null);
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    if (!(Number(amount) > 0)) { toast.error("Enter the amount"); return; }
    if (reason.trim().length < 2) { toast.error("Write what it was for"); return; }
    if (!category) { toast.error("Pick what kind of cost it was"); return; }
    let bill_path: string | null = null;
    if (bill) {
      const isPdf = bill.type === "application/pdf";
      const body = isPdf ? bill : await shrink(bill).catch(() => null);
      if (!body) { toast.error("Couldn't read that photo — use a JPG/PNG or a PDF"); return; }
      const slot = await createPosBillUpload(isPdf ? "application/pdf" : "image/jpeg");
      if ("error" in slot) { toast.error(slot.error ?? "Couldn't upload the bill"); return; }
      const { error } = await createClient().storage.from("pos-bills").uploadToSignedUrl(slot.path!, slot.token!, body, { contentType: isPdf ? "application/pdf" : "image/jpeg" });
      if (error) { toast.error("The bill photo didn't upload — try again"); return; }
      bill_path = slot.path!;
    }
    const r = await addPosExpense({ amount: Number(amount), reason: reason.trim(), category, paid_with: paidWith, bill_path });
    if ("error" in r) { toast.error(r.error ?? "Couldn't save"); return; }
    toast.success(paidWith === "till_cash" ? `Saved — ${npr(Number(amount))} comes off the cash count` : "Expense saved");
    setAmount(""); setReason(""); setCategory(""); setBill(null);
    onSaved();
  });

  const requests = day.requests.filter((r) => r.kind.startsWith("expense_"));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className={card}>
          <p className={cn("text-xs font-bold uppercase tracking-wide", muted)}>Spent today</p>
          <p className="font-display text-2xl font-extrabold tabular-nums">{npr(day.expensesTotal)}</p>
        </div>
        <div className={card}>
          <p className={cn("text-xs font-bold uppercase tracking-wide", muted)}>From the till</p>
          <p className="font-display text-2xl font-extrabold tabular-nums">{npr(day.tillCashUsed)}</p>
          <p className={cn("text-[11px]", muted)}>comes off Close shift&apos;s cash</p>
        </div>
      </div>

      <div className={cn(card, "space-y-3")}>
        <p className="font-bold">Add an expense</p>
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <input value={amount} onChange={(e) => setAmount(num(e.target.value))} inputMode="decimal" placeholder="Rs" aria-label="Amount"
            className={cn(field, "text-right font-display text-xl font-bold")} />
          <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} placeholder="What was it for? e.g. 2 cylinders of gas" aria-label="Reason" className={field} />
        </div>
        <div>
          <p className={cn("mb-1.5 text-xs font-bold", muted)}>Kind of cost</p>
          <div className="flex flex-wrap gap-1.5">
            {EXPENSE_CATEGORIES.map((c) => <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={category === c} className={chip(category === c)}>{c}</button>)}
          </div>
        </div>
        <div>
          <p className={cn("mb-1.5 text-xs font-bold", muted)}>Paid with</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PAID_WITH) as PaidWith[]).map((k) => <button key={k} type="button" onClick={() => setPaidWith(k)} aria-pressed={paidWith === k} className={chip(paidWith === k)}>{PAID_WITH[k]}</button>)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-full bg-stone-100 px-4 py-2.5 text-sm font-bold dark:bg-stone-800">
            <Camera size={16} /> {bill ? "Change the bill photo" : "Bill photo (optional)"}
            <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => setBill(e.target.files?.[0] ?? null)} />
          </label>
          {bill && <span className={cn("flex items-center gap-1 text-xs", muted)}><Paperclip size={12} /> {bill.name.slice(0, 30)} <button onClick={() => setBill(null)} className="font-bold text-brand-red">remove</button></span>}
          <button onClick={save} disabled={pending} className="btn-primary ml-auto !px-6 !py-3">{pending ? "Saving…" : "Save expense"}</button>
        </div>
      </div>

      <section>
        <p className="mb-2 font-bold">Today</p>
        {day.expenses.length === 0 ? <p className={cn("text-sm", muted)}>No expenses yet today.</p> : (
          <ul className="space-y-2">{day.expenses.map((e) => <ExpenseRow key={e.id} e={e} onSaved={onSaved} />)}</ul>
        )}
      </section>
      <RequestList requests={requests} />
    </div>
  );
}

function ExpenseRow({ e, onSaved }: { e: OutletExpense; onSaved: () => void }) {
  const [asking, setAsking] = useState(false);
  const [remove, setRemove] = useState(false);
  const [amount, setAmount] = useState(String(e.amount));
  const [reason, setReason] = useState(e.reason);
  const [why, setWhy] = useState("");
  const [pending, start] = useTransition();
  const send = () => start(async () => {
    const r = await requestExpenseChange(e.id, remove ? { remove: true, why } : { amount: Number(amount), reason: reason.trim(), why });
    if ("error" in r) { toast.error(r.error ?? "Couldn't send"); return; }
    toast.success("Sent for approval — an Accounts person will check it");
    setAsking(false); setWhy(""); onSaved();
  });
  return (
    <li className={card}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">{e.reason}</p>
          <p className={cn("text-xs", muted)}>
            {e.category} · {PAID_WITH[e.paidWith as PaidWith] ?? e.paidWith} · {e.personName} · {npTime(e.createdAt)}
            {e.hasBill && " · bill attached"}{e.edited && " · changed"}
          </p>
          {e.pending && <p className="mt-1 flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400"><Clock size={12} /> A change is waiting for approval</p>}
        </div>
        <p className="shrink-0 font-display text-lg font-extrabold tabular-nums">{npr(e.amount)}</p>
      </div>
      {!e.pending && !asking && <button onClick={() => setAsking(true)} className="mt-2 text-xs font-bold text-brand-orange">Ask to change or remove</button>}
      {asking && (
        <div className="mt-3 space-y-2 border-t border-stone-100 pt-3 dark:border-stone-800">
          <div className="flex gap-1.5">
            <button onClick={() => setRemove(false)} aria-pressed={!remove} className={chip(!remove)}>Change it</button>
            <button onClick={() => setRemove(true)} aria-pressed={remove} className={chip(remove)}>Remove it</button>
          </div>
          {!remove && (
            <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
              <input value={amount} onChange={(ev) => setAmount(num(ev.target.value))} inputMode="decimal" aria-label="Right amount" className={cn(field, "text-right font-bold")} />
              <input value={reason} onChange={(ev) => setReason(ev.target.value.slice(0, 300))} aria-label="What it was for" className={field} />
            </div>
          )}
          <input value={why} onChange={(ev) => setWhy(ev.target.value.slice(0, 300))} placeholder="Why? e.g. typed 500 instead of 50" aria-label="Why" className={field} />
          <div className="flex gap-2">
            <button onClick={send} disabled={pending || why.trim().length < 2} className="btn-primary !px-5 !py-2.5 text-sm">{pending ? "Sending…" : "Send for approval"}</button>
            <button onClick={() => setAsking(false)} className={cn("px-3 text-sm font-bold", muted)}>Cancel</button>
          </div>
        </div>
      )}
    </li>
  );
}

// ── Stock ────────────────────────────────────────────────────────
function StockTab({ day, stock, canAdd, canFix, onSaved }: { day: Day; stock: PosStock | null; canAdd: boolean; canFix: boolean; onSaved: () => void }) {
  const requests = day.requests.filter((r) => r.kind.startsWith("stock_"));
  return (
    <div className="space-y-4">
      <p className={cn("text-sm", muted)}>
        {canAdd && "Adding stock that has arrived counts straight away. "}
        {canFix && "Waste, a recount or fixing an add waits until an Accounts person approves it."}
      </p>
      {!stock ? <p className={cn("text-sm", muted)}>Loading stock…</p> : stock.all.length === 0 ? (
        <p className={cn("text-sm", muted)}>No stock items yet — they&apos;re set up in the Accounts app.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">{stock.all.map((s) => <StockRow key={s.id} s={s} canAdd={canAdd} canFix={canFix} onSaved={onSaved} />)}</ul>
      )}
      {canFix && day.stockAdds.length > 0 && (
        <section>
          <p className="mb-2 font-bold">Stock added on the POS (last 7 days)</p>
          <ul className="space-y-2">{day.stockAdds.map((a) => <StockAddRow key={a.id} a={a} onSaved={onSaved} />)}</ul>
        </section>
      )}
      <RequestList requests={requests} />
    </div>
  );
}

function StockRow({ s, canAdd, canFix, onSaved }: { s: StockLevel; canAdd: boolean; canFix: boolean; onSaved: () => void }) {
  const [mode, setMode] = useState<"add" | "stock_waste" | "stock_count" | null>(null);
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const close = () => { setMode(null); setQty(""); setNote(""); };
  const send = () => start(async () => {
    const quantity = Number(qty);
    const r = mode === "add"
      ? await addPosStock({ item: s.id, quantity, note: note.trim() || undefined })
      : await requestStockChange({ kind: mode!, item: s.id, quantity, why: note.trim() });
    if ("error" in r) { toast.error(r.error ?? "Couldn't save"); return; }
    toast.success(mode === "add" ? `Added ${quantity} ${s.unit} of ${s.name}` : "Sent for approval — an Accounts person will check it");
    close(); onSaved();
  });
  return (
    <li className={card}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold">{s.name}</p>
        <p className={cn("shrink-0 font-display text-lg font-extrabold tabular-nums", s.state === "out" ? "text-brand-red" : s.state === "low" ? "text-amber-600 dark:text-amber-400" : "")}>
          {s.remaining} <span className={cn("text-xs font-bold", muted)}>{s.unit}</span>
        </p>
      </div>
      {!mode && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {canAdd && <button onClick={() => setMode("add")} className="rounded-full bg-brand-green px-3 py-1.5 text-xs font-bold text-white">+ Add stock</button>}
          {canFix && <button onClick={() => setMode("stock_waste")} className="rounded-full px-3 py-1.5 text-xs font-bold text-stone-600 ring-1 ring-stone-200 dark:text-stone-300 dark:ring-stone-700">Waste</button>}
          {canFix && <button onClick={() => setMode("stock_count")} className="rounded-full px-3 py-1.5 text-xs font-bold text-stone-600 ring-1 ring-stone-200 dark:text-stone-300 dark:ring-stone-700">Recount</button>}
        </div>
      )}
      {mode && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-bold">{mode === "add" ? "How much arrived?" : mode === "stock_waste" ? "How much was wasted?" : "How much is there really?"}</p>
          <div className="flex gap-2">
            <input value={qty} onChange={(e) => setQty(num(e.target.value))} inputMode="decimal" placeholder={s.unit} aria-label="Amount" autoFocus className={cn(field, "!w-28 text-right font-bold")} />
            <input value={note} onChange={(e) => setNote(e.target.value.slice(0, mode === "add" ? 200 : 300))}
              placeholder={mode === "add" ? "Note (optional), e.g. from the supplier" : "Why? (needed)"} aria-label="Note" className={field} />
          </div>
          <div className="flex gap-2">
            <button onClick={send} disabled={pending || qty === "" || (mode !== "add" && note.trim().length < 2)} className="btn-primary !px-5 !py-2.5 text-sm">
              {pending ? "Saving…" : mode === "add" ? "Add" : "Send for approval"}
            </button>
            <button onClick={close} className={cn("px-3 text-sm font-bold", muted)}>Cancel</button>
          </div>
        </div>
      )}
    </li>
  );
}

function StockAddRow({ a, onSaved }: { a: Day["stockAdds"][number]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(String(a.quantity));
  const [why, setWhy] = useState("");
  const [pending, start] = useTransition();
  const send = () => start(async () => {
    const r = await requestStockChange({ kind: "stock_fix", movement: a.id, quantity: Number(qty), why: why.trim() });
    if ("error" in r) { toast.error(r.error ?? "Couldn't send"); return; }
    toast.success("Sent for approval"); setOpen(false); setWhy(""); onSaved();
  });
  return (
    <li className={card}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <p><b>+{a.quantity} {a.unit}</b> {a.item} <span className={muted}>· {a.personName} · {npDayMonthTime(a.createdAt)}</span></p>
        {!open && <button onClick={() => setOpen(true)} className="shrink-0 text-xs font-bold text-brand-orange">Fix</button>}
      </div>
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-xs font-bold">The right amount (0 if it never came)</p>
          <div className="flex gap-2">
            <input value={qty} onChange={(e) => setQty(num(e.target.value))} inputMode="decimal" aria-label="Right amount" className={cn(field, "!w-28 text-right font-bold")} />
            <input value={why} onChange={(e) => setWhy(e.target.value.slice(0, 300))} placeholder="Why? (needed)" aria-label="Why" className={field} />
          </div>
          <div className="flex gap-2">
            <button onClick={send} disabled={pending || why.trim().length < 2} className="btn-primary !px-5 !py-2.5 text-sm">{pending ? "Sending…" : "Send for approval"}</button>
            <button onClick={() => setOpen(false)} className={cn("px-3 text-sm font-bold", muted)}>Cancel</button>
          </div>
        </div>
      )}
    </li>
  );
}

// ── Issues & notes ───────────────────────────────────────────────
function IssuesTab({ day, onSaved }: { day: Day; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [kind, setKind] = useState<IssueKind>("other");
  const [urgent, setUrgent] = useState(false);
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await addIssue({ title: title.trim(), details: details.trim() || undefined, kind, urgent });
    if ("error" in r) { toast.error(r.error ?? "Couldn't save"); return; }
    toast.success("Noted — the manager sees it in Accounts → POS");
    setTitle(""); setDetails(""); setKind("other"); setUrgent(false); onSaved();
  });
  const open = day.issues.filter((i) => !i.resolvedAt).sort((a, b) => Number(b.urgent) - Number(a.urgent));
  const closed = day.issues.filter((i) => i.resolvedAt);
  return (
    <div className="space-y-4">
      <div className={cn(card, "space-y-3")}>
        <p className="font-bold">Note an issue</p>
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} placeholder="What happened? e.g. Fridge isn't cooling" aria-label="What happened" className={field} />
        <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 1000))} rows={3} placeholder="More details (optional)" aria-label="Details" className={field} />
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(ISSUE_KINDS) as IssueKind[]).map((k) => <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={chip(kind === k)}>{ISSUE_KINDS[k]}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="h-5 w-5 accent-brand-red" /> Urgent
          </label>
          <button onClick={save} disabled={pending || title.trim().length < 2} className="btn-primary ml-auto !px-6 !py-3">{pending ? "Saving…" : "Save note"}</button>
        </div>
      </div>
      <section>
        <p className="mb-2 font-bold">Open ({open.length})</p>
        {open.length === 0 ? <p className={cn("text-sm", muted)}>Nothing open.</p> : (
          <ul className="space-y-2">
            {open.map((i) => (
              <li key={i.id} className={cn(card, i.urgent && "ring-2 ring-red-300 dark:ring-red-900")}>
                <p className="flex items-center gap-1.5 font-bold">{i.urgent && <AlertTriangle size={15} className="shrink-0 text-brand-red" />} {i.title}</p>
                {i.details && <p className="mt-0.5 whitespace-pre-line text-sm">{i.details}</p>}
                <p className={cn("mt-1 text-xs", muted)}>{ISSUE_KINDS[i.kind as IssueKind] ?? i.kind} · {i.personName} · {npDayMonthTime(i.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {closed.length > 0 && (
        <section>
          <p className="mb-2 font-bold">Sorted this week</p>
          <ul className="space-y-2">
            {closed.map((i) => (
              <li key={i.id} className={cn(card, "opacity-80")}>
                <p className="flex items-center gap-1.5 font-bold"><CheckCircle2 size={15} className="shrink-0 text-brand-green" /> {i.title}</p>
                <p className={cn("mt-1 text-xs", muted)}>
                  Sorted by {i.resolvedBy ?? "the manager"} · {npDayMonthTime(i.resolvedAt!)}{i.resolution ? ` — ${i.resolution}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ── Requests waiting for / decided by an Accounts person ─────────
function RequestList({ requests }: { requests: OutletRequest[] }) {
  if (!requests.length) return null;
  const STATUS = {
    pending: { label: "Waiting", tint: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
    approved: { label: "Approved", tint: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300" },
    rejected: { label: "Not approved", tint: "bg-red-100 text-brand-red dark:bg-red-950/50 dark:text-red-300" },
  } as Record<string, { label: string; tint: string }>;
  return (
    <section>
      <p className="mb-2 font-bold">Sent for approval</p>
      <ul className="space-y-2">
        {requests.map((r) => (
          <li key={r.id} className={cn(card, "flex items-start justify-between gap-3")}>
            <div className="min-w-0 text-sm">
              <p className="font-bold">{r.label}</p>
              <p className={cn("text-xs", muted)}>&ldquo;{r.reason}&rdquo; · {r.personName} · {npDayMonthTime(r.createdAt)}</p>
              {r.status !== "pending" && (r.decidedName || r.decisionNote) && (
                <p className={cn("mt-0.5 text-xs", muted)}>{r.decidedName ? `By ${r.decidedName}` : ""}{r.decisionNote ? ` — ${r.decisionNote}` : ""}</p>
              )}
            </div>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase", STATUS[r.status]?.tint)}>{STATUS[r.status]?.label ?? r.status}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
