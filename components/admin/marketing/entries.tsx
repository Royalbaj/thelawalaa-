"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowDownCircle, ArrowUpCircle, Pencil, Trash2, X } from "lucide-react";
import { saveMarketingEntry, deleteMarketingEntry } from "@/app/actions/marketing";
import { CATEGORIES, CATEGORY_SHORT, PAYMENT_METHODS, type Category, type PaymentMethod } from "@/lib/marketing-shared";
import type { Entry } from "@/lib/marketing";
import { npr, cn } from "@/lib/utils";

type ActivityOption = { id: string; name: string; category: Category; status: string };
export const nepalTodayYmd = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" });

/** Record an expense (money spent on marketing) or a return (what it brought back). */
export function EntryForm({ activities, defaultDate, initial, onDone }: {
  activities: ActivityOption[]; defaultDate: string; initial?: Entry; onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<"expense" | "return">(initial?.kind ?? "expense");
  const [date, setDate] = useState(initial?.entry_date ?? defaultDate);
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [activityId, setActivityId] = useState(initial?.activity_id ?? "");
  const [category, setCategory] = useState<Category>(initial?.category ?? "printing");
  const [method, setMethod] = useState<PaymentMethod>(initial?.payment_method ?? "cash");
  const [customers, setCustomers] = useState(initial?.new_customers != null ? String(initial.new_customers) : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const usable = activities.filter((a) => a.status !== "ended" || a.id === initial?.activity_id);

  const pickActivity = (id: string) => {
    setActivityId(id);
    const a = activities.find((x) => x.id === id);
    if (a) setCategory(a.category);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await saveMarketingEntry(initial?.id ?? null, {
        kind, entry_date: date, category, activity_id: activityId || null, amount: Number(amount),
        new_customers: kind === "return" && customers ? Number(customers) : null,
        payment_method: kind === "expense" ? method : null, note,
      });
      if ("error" in r && r.error) { toast.error(r.error); return; }
      toast.success(initial ? "Saved" : kind === "expense" ? `Expense of ${npr(Number(amount))} recorded` : `Return of ${npr(Number(amount))} recorded`);
      if (!initial) { setAmount(""); setNote(""); setCustomers(""); }
      router.refresh();
      onDone?.();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-stone-100 p-1" role="tablist" aria-label="Expense or return">
        {([["expense", "Expense", ArrowUpCircle], ["return", "Return", ArrowDownCircle]] as const).map(([k, label, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
            className={cn("flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold transition",
              kind === k ? (k === "expense" ? "bg-white text-brand-orange shadow-sm" : "bg-white text-blue-700 shadow-sm") : "text-stone-500")}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-stone-500">
        {kind === "expense" ? "Money spent on marketing — printing, sponsorships, samples, giveaways, social media…" : "What marketing brought back — extra sales, event takings, a catering order, membership cards sold…"}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="e-amount">Amount (Rs)</label>
          <input id="e-amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="2000" required /></div>
        <div><label className="label" htmlFor="e-date">Date</label>
          <input id="e-date" type="date" className="input !px-2" value={date} max={nepalTodayYmd()} onChange={(e) => setDate(e.target.value)} required /></div>
      </div>
      {usable.length > 0 && (
        <div><label className="label" htmlFor="e-activity">Activity <span className="font-normal text-stone-400">(optional)</span></label>
          <select id="e-activity" className="input" value={activityId} onChange={(e) => pickActivity(e.target.value)}>
            <option value="">None</option>
            {usable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></div>
      )}
      <div><label className="label" htmlFor="e-category">Category</label>
        <select id="e-category" className="input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></div>
      {kind === "expense" ? (
        <div><label className="label">Paid by</label>
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.entries(PAYMENT_METHODS) as [PaymentMethod, string][]).map(([k, v]) => (
              <button key={k} type="button" onClick={() => setMethod(k)}
                className={cn("rounded-xl py-2 text-xs font-bold ring-1 transition", method === k ? "bg-orange-50 text-brand-orange ring-brand-orange" : "text-stone-500 ring-stone-200")}>{v}</button>
            ))}
          </div></div>
      ) : (
        <div><label className="label" htmlFor="e-customers">New customers <span className="font-normal text-stone-400">(optional)</span></label>
          <input id="e-customers" className="input" inputMode="numeric" value={customers} onChange={(e) => setCustomers(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 12" /></div>
      )}
      <div><label className="label" htmlFor="e-note">Note <span className="font-normal text-stone-400">(optional)</span></label>
        <input id="e-note" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={kind === "expense" ? "500 flyers from Banepa Printers" : "Sold 40 plates at the school event"} /></div>
      <button disabled={pending || !amount || Number(amount) <= 0}
        className={cn("w-full rounded-full py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50", kind === "expense" ? "bg-brand-orange" : "bg-blue-600")}>
        {pending ? "Saving…" : initial ? "Save changes" : kind === "expense" ? "Record expense" : "Record return"}
      </button>
    </form>
  );
}

export function EntryList({ entries, activities }: { entries: Entry[]; activities: ActivityOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<"all" | "expense" | "return">("all");
  const [editing, setEditing] = useState<Entry | null>(null);
  const shown = entries.filter((e) => filter === "all" || e.kind === filter);

  return (
    <div>
      <div className="mb-3 flex gap-1.5">
        {([["all", "All"], ["expense", "Expenses"], ["return", "Returns"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-bold transition", filter === k ? "bg-brand-brown text-white" : "bg-stone-100 text-stone-600")}>
            {label} ({k === "all" ? entries.length : entries.filter((e) => e.kind === k).length})
          </button>
        ))}
      </div>
      {shown.length === 0 ? <p className="py-8 text-center text-sm text-stone-400">Nothing recorded for this month.</p> : (
        <ul className="divide-y divide-stone-100">
          {shown.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2.5">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", e.kind === "expense" ? "bg-orange-50 text-brand-orange" : "bg-blue-50 text-blue-600")}>
                {e.kind === "expense" ? <ArrowUpCircle size={17} /> : <ArrowDownCircle size={17} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-stone-800">{e.note || (e.activity ?? CATEGORY_SHORT[e.category])}</p>
                <p className="truncate text-xs text-stone-500">
                  {e.entry_date} · {CATEGORY_SHORT[e.category]}{e.activity ? ` · ${e.activity}` : ""}
                  {e.payment_method ? ` · ${PAYMENT_METHODS[e.payment_method]}` : ""}{e.new_customers ? ` · ${e.new_customers} new customers` : ""}
                </p>
              </div>
              <b className={cn("shrink-0 tabular-nums", e.kind === "expense" ? "text-brand-brown" : "text-blue-700")}>{e.kind === "expense" ? "−" : "+"}{npr(e.amount)}</b>
              <button onClick={() => setEditing(e)} aria-label="Edit" className="shrink-0 rounded-full p-1.5 text-stone-300 hover:bg-stone-100 hover:text-stone-600"><Pencil size={14} /></button>
              <button disabled={pending} aria-label="Delete" onClick={() => {
                if (confirm(`Delete this ${e.kind} of ${npr(e.amount)}?`)) start(async () => { await deleteMarketingEntry(e.id); toast.success("Deleted"); router.refresh(); });
              }} className="shrink-0 rounded-full p-1.5 text-stone-300 hover:bg-red-50 hover:text-brand-red"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Edit entry">
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-brand-brown">Edit entry</h2>
              <button onClick={() => setEditing(null)} aria-label="Close" className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100"><X size={18} /></button>
            </div>
            <EntryForm activities={activities} defaultDate={editing.entry_date} initial={editing} onDone={() => setEditing(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
