"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Pencil, Eye, EyeOff, Plus, Check, X } from "lucide-react";
import { setOpeningBalance, addCategory, updateCategory } from "@/app/actions/ledger";
import { changePin } from "@/app/actions/pin";
import { cn } from "@/lib/utils";

type Kind = "in" | "out";
type Cat = { id: string; kind: Kind; name: string; is_active: boolean };

export function OpeningBalanceForm({ value }: { value: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(value));
  const [pending, start] = useTransition();
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await setOpeningBalance(amount);
        if (r?.error) toast.error(r.error); else { toast.success("Starting money saved"); router.refresh(); }
      });
    }}>
      <label className="flex-1">
        <span className="label">Money you had when you started this book (cash + bank)</span>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.-]/g, ""))} inputMode="decimal"
          className="input text-base sm:text-sm" placeholder="0" />
      </label>
      <button disabled={pending} className="btn-primary !py-2.5">{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}

function CategoryItem({ c }: { c: Cat }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const [pending, start] = useTransition();
  const run = (patch: { name?: string; is_active?: boolean }, done: string) => start(async () => {
    const r = await updateCategory(c.id, patch);
    if (r?.error) toast.error(r.error); else { toast.success(done); setEditing(false); router.refresh(); }
  });
  return (
    <li className={cn("flex items-center gap-2 py-2", !c.is_active && "opacity-50")}>
      {editing ? (
        <form className="flex flex-1 items-center gap-1" onSubmit={(e) => { e.preventDefault(); run({ name }, "Renamed"); }}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus className="input !py-1.5 text-base sm:text-sm" />
          <button disabled={pending} aria-label="Save name" className="p-2 text-green-700"><Check size={16} /></button>
          <button type="button" onClick={() => { setName(c.name); setEditing(false); }} aria-label="Cancel" className="p-2 text-stone-400"><X size={16} /></button>
        </form>
      ) : (
        <>
          <span className="flex-1 text-sm font-bold text-stone-700">{c.name}{!c.is_active && <span className="ml-1.5 text-xs font-normal">(hidden)</span>}</span>
          <button onClick={() => setEditing(true)} aria-label={`Rename ${c.name}`} className="p-2 text-stone-400 hover:text-brand-orange"><Pencil size={15} /></button>
          <button disabled={pending} onClick={() => run({ is_active: !c.is_active }, c.is_active ? "Hidden from new entries" : "Shown again")}
            aria-label={c.is_active ? `Hide ${c.name}` : `Show ${c.name}`} title={c.is_active ? "Hide (old entries keep it)" : "Show again"}
            className="p-2 text-stone-400 hover:text-brand-brown">
            {c.is_active ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </>
      )}
    </li>
  );
}

export function CategoriesManager({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<Kind, string>>({ in: "", out: "" });
  const [pending, start] = useTransition();
  const add = (kind: Kind) => start(async () => {
    const r = await addCategory(kind, drafts[kind]);
    if (r?.error) toast.error(r.error);
    else { toast.success("Category added"); setDrafts((d) => ({ ...d, [kind]: "" })); router.refresh(); }
  });
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {(["out", "in"] as Kind[]).map((kind) => (
        <div key={kind}>
          <h3 className="mb-1 flex items-center gap-1.5 font-bold text-brand-brown">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: kind === "in" ? "#2a78d6" : "#eb6834" }} />
            {kind === "in" ? "Money in" : "Money out"}
          </h3>
          <ul className="divide-y divide-stone-100">
            {categories.filter((c) => c.kind === kind).map((c) => <CategoryItem key={c.id} c={c} />)}
          </ul>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); add(kind); }}>
            <input value={drafts[kind]} onChange={(e) => setDrafts((d) => ({ ...d, [kind]: e.target.value }))} maxLength={40}
              placeholder={kind === "in" ? "e.g. Catering order" : "e.g. Cleaning supplies"} className="input !py-2 text-base sm:text-sm" />
            <button disabled={pending || !drafts[kind].trim()} className="btn-primary !px-4 !py-2 text-sm"><Plus size={15} /> Add</button>
          </form>
        </div>
      ))}
    </div>
  );
}

export function ChangePinForm() {
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-2 sm:grid-cols-4 sm:items-end" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = Object.fromEntries(new FormData(form));
      start(async () => {
        const r = await changePin(fd);
        if (r?.error) toast.error(r.error); else { toast.success("PIN changed — use the new one next time"); form.reset(); }
      });
    }}>
      {([["current", "Your PIN now"], ["next", "New PIN"], ["confirm", "New PIN again"]] as const).map(([name, label]) => (
        <label key={name}>
          <span className="label">{label}</span>
          <input name={name} type="password" inputMode="numeric" pattern="\d{4}" maxLength={4} required autoComplete="off"
            className="input text-base tracking-[0.5em] sm:text-sm" />
        </label>
      ))}
      <button disabled={pending} className="btn-primary !py-2.5">{pending ? "Saving…" : "Change PIN"}</button>
    </form>
  );
}
