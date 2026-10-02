"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowDownLeft, ArrowUpRight, Camera, FileText, Plus, Trash2, X, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { saveEntry, deleteEntry, createBillUpload, addCategory } from "@/app/actions/ledger";
import { addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Kind = "in" | "out";
type Method = "cash" | "bank" | "qr";
type Cat = { id: string; kind: Kind; name: string; is_active: boolean };
export type EditableEntry = {
  id: string; kind: Kind; amount: number; category_id: string; description: string | null;
  occurred_on: string; method: Method; bill_path: string | null;
};

const IN = "#2a78d6";
const OUT = "#eb6834";
const MAX_BYTES = 10 * 1024 * 1024;

// Phone photos are 3–10 MB; a bill stays readable at 1600px as JPEG and
// uploads in a second or two on mobile data. PDFs go up as they are.
async function prepareBill(file: File): Promise<Blob> {
  if (file.type === "application/pdf") {
    if (file.size > MAX_BYTES) throw new Error("That PDF is over 10 MB");
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo"))), "image/jpeg", 0.85));
  } catch {
    // Couldn't shrink it here — send the original if it's a type Storage takes.
    if (["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= MAX_BYTES) return file;
    throw new Error("Use a JPG/PNG photo or a PDF (max 10 MB)");
  }
}

export default function EntryForm({ categories: initialCats, entry, defaultKind, today, back }: {
  categories: Cat[]; entry?: EditableEntry; defaultKind: Kind; today: string; back: string;
}) {
  const router = useRouter();
  const [cats, setCats] = useState(initialCats);
  const [kind, setKind] = useState<Kind>(entry?.kind ?? defaultKind);
  const firstOf = (k: Kind) => cats.find((c) => c.kind === k && c.is_active)?.id ?? "";
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [categoryId, setCategoryId] = useState(entry?.category_id ?? firstOf(entry?.kind ?? defaultKind));
  const [date, setDate] = useState(entry?.occurred_on ?? today);
  const [method, setMethod] = useState<Method>(entry?.method ?? "cash");
  const [description, setDescription] = useState(entry?.description ?? "");
  const [bill, setBill] = useState<File | null>(null);
  const [keepBill, setKeepBill] = useState(!!entry?.bill_path);
  const [newCat, setNewCat] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const color = kind === "in" ? IN : OUT;
  const kindCats = cats.filter((c) => c.kind === kind && (c.is_active || c.id === entry?.category_id));
  const preview = useMemo(() => (bill && bill.type.startsWith("image/") ? URL.createObjectURL(bill) : null), [bill]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const switchKind = (k: Kind) => {
    setKind(k);
    if (cats.find((c) => c.id === categoryId)?.kind !== k) setCategoryId(firstOf(k));
  };

  const createCategory = () => start(async () => {
    const r = await addCategory(kind, newCat ?? "");
    if (r?.error || !r.category) { toast.error(r?.error ?? "Couldn't add it"); return; }
    setCats((c) => [...c, r.category as Cat]);
    setCategoryId(r.category.id);
    setNewCat(null);
  });

  const save = (another: boolean) => start(async () => {
    if (!(Number(amount) > 0)) { toast.error("Enter the amount"); amountRef.current?.focus(); return; }
    if (!categoryId) { toast.error("Pick a category"); return; }
    try {
      // undefined = leave the bill as it is; null = remove it; a path = the new one.
      let bill_path: string | null | undefined = entry ? (keepBill ? undefined : null) : null;
      if (bill) {
        const blob = await prepareBill(bill);
        const slot = await createBillUpload(blob.type);
        if (!slot.path || !slot.token) throw new Error(slot.error ?? "Couldn't upload the bill");
        const { error } = await createClient().storage.from("account-bills")
          .uploadToSignedUrl(slot.path, slot.token, blob, { contentType: blob.type });
        if (error) throw new Error("The bill didn't upload — check the internet and try again");
        bill_path = slot.path;
      }
      const r = await saveEntry(entry?.id ?? null, {
        kind, amount, category_id: categoryId, occurred_on: date, method, description, bill_path,
      });
      if (r?.error) throw new Error(r.error);
      toast.success(entry ? "Saved" : kind === "in" ? "Money in added" : "Money out added");
      if (another) {
        setAmount(""); setDescription(""); setBill(null);
        amountRef.current?.focus();
        router.refresh();
      } else {
        router.push(back);
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    }
  });

  const remove = () => {
    if (!entry || !confirm("Delete this entry? This can't be undone.")) return;
    start(async () => {
      const r = await deleteEntry(entry.id);
      if (r?.error) { toast.error(r.error); return; }
      toast.success("Deleted");
      router.push(back);
      router.refresh();
    });
  };

  const seg = (active: boolean) => cn(
    "flex flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold transition",
    active ? "text-white shadow-sm" : "bg-white text-stone-600 ring-1 ring-stone-200",
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(false); }} className="space-y-5 pb-24 md:pb-0">
      {/* In / out */}
      <div className="flex gap-2">
        {(["in", "out"] as const).map((k) => (
          <button key={k} type="button" onClick={() => switchKind(k)} aria-pressed={kind === k}
            className={seg(kind === k)} style={kind === k ? { background: k === "in" ? IN : OUT } : undefined}>
            {k === "in" ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
            {k === "in" ? "Money in" : "Money out"}
          </button>
        ))}
      </div>

      {/* Amount */}
      <label className="block">
        <span className="label">Amount</span>
        <span className="flex items-center rounded-2xl border-2 bg-white px-4 transition focus-within:ring-4 focus-within:ring-stone-200" style={{ borderColor: color }}>
          <span className="font-display text-2xl font-bold text-stone-400">Rs</span>
          <input ref={amountRef} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, "").slice(0, 12))}
            inputMode="decimal" placeholder="0" autoFocus={!entry} aria-label="Amount in rupees"
            className="w-full bg-transparent px-3 py-3 font-display text-4xl font-bold text-stone-900 outline-none" />
        </span>
      </label>

      {/* Category */}
      <div>
        <span className="label">Category</span>
        <div className="flex flex-wrap gap-2">
          {kindCats.map((c) => (
            <button key={c.id} type="button" onClick={() => setCategoryId(c.id)} aria-pressed={categoryId === c.id}
              className={cn("touch-manipulation rounded-full px-3.5 py-2 text-sm font-bold transition",
                categoryId === c.id ? "text-white" : "bg-white text-stone-600 ring-1 ring-stone-200")}
              style={categoryId === c.id ? { background: color } : undefined}>
              {c.name}
            </button>
          ))}
          {newCat === null ? (
            <button type="button" onClick={() => setNewCat("")}
              className="flex items-center gap-1 rounded-full border border-dashed border-orange-300 px-3.5 py-2 text-sm font-bold text-brand-orange">
              <Plus size={14} /> New
            </button>
          ) : (
            <span className="flex w-full items-center gap-2 sm:w-auto">
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category name" maxLength={40} autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createCategory(); } }}
                className="input !py-2 text-base sm:w-56 sm:text-sm" />
              <button type="button" onClick={createCategory} disabled={pending || !newCat?.trim()} className="btn-primary !px-4 !py-2 text-sm">Add</button>
              <button type="button" onClick={() => setNewCat(null)} aria-label="Cancel" className="p-2 text-stone-400"><X size={16} /></button>
            </span>
          )}
        </div>
      </div>

      {/* Date + how it was paid */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <span className="label">Date</span>
          <div className="flex gap-2">
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required
              className="input !py-2.5 text-base sm:text-sm" aria-label="Date" />
            <button type="button" onClick={() => setDate(today)} className={cn("shrink-0 rounded-xl px-3 text-sm font-bold ring-1", date === today ? "bg-brand-brown text-white ring-brand-brown" : "bg-white text-stone-600 ring-stone-200")}>Today</button>
            <button type="button" onClick={() => setDate(addDays(today, -1))} className={cn("shrink-0 rounded-xl px-3 text-sm font-bold ring-1", date === addDays(today, -1) ? "bg-brand-brown text-white ring-brand-brown" : "bg-white text-stone-600 ring-stone-200")}>Yesterday</button>
          </div>
        </div>
        <div>
          <span className="label">{kind === "in" ? "Received by" : "Paid by"}</span>
          <div className="flex rounded-xl bg-stone-200/60 p-1">
            {([["cash", "Cash"], ["bank", "Bank"], ["qr", "QR / eSewa"]] as const).map(([m, label]) => (
              <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m}
                className={cn("flex-1 touch-manipulation rounded-lg py-2 text-sm font-bold transition", method === m ? "bg-white text-brand-brown shadow-sm" : "text-stone-500")}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Note */}
      <label className="block">
        <span className="label">Note <span className="font-normal text-stone-400">(optional)</span></span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={300}
          placeholder={kind === "in" ? "e.g. Counter sales, morning shift" : "e.g. 10 kg chicken from Ram Traders"}
          className="input text-base sm:text-sm" />
      </label>

      {/* Bill */}
      <div>
        <span className="label">Bill <span className="font-normal text-stone-400">(optional — photo or PDF)</span></span>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setBill(f); }} />
        {bill ? (
          <div className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-stone-200">
            {preview ? <img src={preview} alt="" className="h-16 w-16 rounded-lg object-cover" /> : <FileText size={28} className="text-stone-400" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{bill.name}</p>
              <p className="text-xs text-stone-500">{(bill.size / 1024 / 1024).toFixed(1)} MB — uploads when you save</p>
            </div>
            <button type="button" onClick={() => setBill(null)} aria-label="Remove bill" className="p-2 text-stone-400 hover:text-brand-red"><X size={18} /></button>
          </div>
        ) : entry?.bill_path && keepBill ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 ring-1 ring-stone-200">
            <a href={`/bills/${entry.id}`} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-sm font-bold text-brand-orange">
              <ExternalLink size={15} /> View bill
            </a>
            <span className="flex-1" />
            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full px-3 py-1.5 text-sm font-bold text-stone-600 ring-1 ring-stone-200">Replace</button>
            <button type="button" onClick={() => setKeepBill(false)} className="rounded-full px-3 py-1.5 text-sm font-bold text-brand-red ring-1 ring-red-200">Remove</button>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 bg-white py-5 text-sm font-bold text-stone-500 transition hover:border-brand-orange hover:text-brand-orange">
            <Camera size={18} /> Take or choose a photo of the bill
          </button>
        )}
      </div>

      {/* Actions — pinned to the bottom on phones */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-stone-200 bg-white p-3 md:static md:border-0 md:bg-transparent md:p-0"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        {entry ? (
          <button type="button" onClick={remove} disabled={pending} aria-label="Delete entry"
            className="flex items-center justify-center rounded-full px-4 text-brand-red ring-1 ring-red-200 disabled:opacity-50">
            <Trash2 size={18} />
          </button>
        ) : (
          <button type="button" onClick={() => save(true)} disabled={pending}
            className="btn-outline flex-1 !px-3 !py-3 text-sm disabled:opacity-50">Save & add another</button>
        )}
        <button disabled={pending} className="btn-primary flex-1 !py-3 disabled:opacity-50" style={{ background: color }}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
