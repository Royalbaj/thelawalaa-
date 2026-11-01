"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Camera, Plus, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { saveLoss, createLossPhotoUpload } from "@/app/actions/losses";
import { prepareBill } from "@/components/entry-form";
import { LOSS_KINDS, LOSS_KIND_KEYS, type LossKind } from "@/lib/loss-kinds";
import { addDays } from "@/lib/dates";
import { npr, cn } from "@/lib/utils";

type Item = { id: string; name: string; unit: string; cost: number };
const num = (v: string) => v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 12);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));

/**
 * "Write down a loss": food wasted, something broken, missing or any other
 * loss. Picking a stock item also takes the amount off stock, and works out
 * what it was worth from the item's cost per unit (it can be typed instead).
 */
export default function LossForm({ items, today, startOpen }: { items: Item[]; today: string; startOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!startOpen);
  const [kind, setKind] = useState<LossKind>("waste");
  const [itemId, setItemId] = useState("");
  const [what, setWhat] = useState("");
  const [qty, setQty] = useState("");
  const [worth, setWorth] = useState("");
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const whatRef = useRef<HTMLInputElement>(null);
  const item = items.find((i) => i.id === itemId) ?? null;
  const guess = item && item.cost > 0 && Number(qty) > 0 ? Math.round(Number(qty) * item.cost * 100) / 100 : null;
  const preview = useMemo(() => (photo && photo.type.startsWith("image/") ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pickItem = (id: string) => {
    const next = items.find((i) => i.id === id);
    // The name follows the item unless something else was typed.
    if (!what.trim() || items.some((i) => i.name === what)) setWhat(next?.name ?? "");
    setItemId(id);
  };
  const reset = () => { setItemId(""); setWhat(""); setQty(""); setWorth(""); setReason(""); setPhoto(null); };

  const save = () => start(async () => {
    if (what.trim().length < 2) { toast.error("Say what it was"); whatRef.current?.focus(); return; }
    if (item && !(Number(qty) > 0)) { toast.error(`How many ${item.unit} were lost?`); return; }
    try {
      let photo_path: string | null = null;
      if (photo) {
        const blob = await prepareBill(photo);
        const slot = await createLossPhotoUpload(blob.type);
        if (!slot.path || !slot.token) throw new Error(slot.error ?? "Couldn't upload the photo");
        const { error } = await createClient().storage.from("account-bills").uploadToSignedUrl(slot.path, slot.token, blob, { contentType: blob.type });
        if (error) throw new Error("The photo didn't upload — check the internet and try again");
        photo_path = slot.path;
      }
      const r = await saveLoss({
        kind, what, occurred_on: date, stock_item_id: item?.id ?? null, quantity: item ? qty : undefined,
        value: worth === "" ? undefined : worth, reason, photo_path,
      });
      if ("error" in r) throw new Error(r.error);
      toast.success(item ? `Recorded — ${fmt(Number(qty))} ${item.unit} taken off stock` : "Loss recorded");
      reset();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    }
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary !px-5 !py-2.5 text-sm"><Plus size={16} /> Write down a loss</button>
    );
  }
  const chip = (on: boolean) => cn("min-h-[44px] rounded-xl px-3 text-sm font-bold ring-1 transition", on ? "bg-brand-brown text-white ring-brand-brown" : "bg-white text-stone-600 ring-stone-200");
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="card space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-brand-brown">Write down a loss</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-2 text-stone-400 hover:bg-stone-100"><X size={18} /></button>
      </div>

      <div>
        <span className="label">What kind?</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LOSS_KIND_KEYS.map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
              className={cn("rounded-xl px-3 py-2.5 text-left text-sm font-bold ring-1 transition",
                kind === k ? "bg-orange-50 text-brand-brown ring-2 ring-brand-orange" : "bg-white text-stone-600 ring-stone-200")}>
              {LOSS_KINDS[k].label}
              <span className="mt-0.5 block text-[11px] font-normal leading-snug text-stone-500">{LOSS_KINDS[k].hint}</span>
            </button>
          ))}
        </div>
      </div>

      {items.length > 0 && (
        <label className="block"><span className="label">A stock item? <span className="font-normal text-stone-400">(it comes off stock)</span></span>
          <select value={itemId} onChange={(e) => pickItem(e.target.value)} className="input text-base sm:text-sm">
            <option value="">No — something else</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem]">
        <label className="block"><span className="label">What was it?</span>
          <input ref={whatRef} value={what} onChange={(e) => setWhat(e.target.value.slice(0, 120))} required
            placeholder={kind === "broken" ? "e.g. 2 steel plates" : kind === "missing" ? "e.g. 1 crate of Coca-Cola" : "e.g. Buff momo filling"} className="input text-base sm:text-sm" />
        </label>
        {item && (
          <label className="block"><span className="label">How many {item.unit}?</span>
            <input value={qty} onChange={(e) => setQty(num(e.target.value))} inputMode="decimal" required placeholder="0" className="input text-base font-bold sm:text-sm" />
          </label>
        )}
        <label className={cn("block", !item && "sm:col-span-2")}><span className="label">Worth (Rs)</span>
          <input value={worth} onChange={(e) => setWorth(num(e.target.value))} inputMode="decimal"
            placeholder={guess != null ? `${fmt(guess)} (from cost)` : "A guess is fine"} className="input text-base sm:text-sm" />
        </label>
      </div>
      {item && (
        <p className="-mt-2 text-xs text-stone-500">
          {item.cost > 0
            ? <>Leave Worth empty to use the cost — {npr(item.cost)} for each one ({item.unit}){guess != null ? ` = ${npr(guess)}` : ""}.</>
            : <>{item.name} has no cost yet — type the worth, or set its &ldquo;Cost of one&rdquo; on the Stock page (Edit).</>}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="label">When?</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setDate(today)} className={chip(date === today)}>Today</button>
            <button type="button" onClick={() => setDate(addDays(today, -1))} className={chip(date === addDays(today, -1))}>Yesterday</button>
            <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" className="input !w-auto min-w-[10rem] flex-1 text-base sm:text-sm" />
          </div>
        </div>
        <label className="block"><span className="label">Why? <span className="font-normal text-stone-400">(optional)</span></span>
          <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} placeholder="e.g. fridge stopped overnight" className="input text-base sm:text-sm" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={(e) => { setPhoto(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        {photo ? (
          <span className="flex items-center gap-2 rounded-xl bg-stone-50 p-1.5 pr-3 text-sm ring-1 ring-stone-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview ? <img src={preview} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="px-2 font-bold">PDF</span>}
            <span className="max-w-[10rem] truncate">{photo.name}</span>
            <button type="button" onClick={() => setPhoto(null)} aria-label="Remove the photo" className="text-stone-400"><X size={15} /></button>
          </span>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-stone-600 ring-1 ring-stone-200">
            <Camera size={16} /> Add a photo <span className="font-normal text-stone-400">(optional)</span>
          </button>
        )}
        <button disabled={pending} className="btn-primary ml-auto !px-6 !py-2.5 text-sm">{pending ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
