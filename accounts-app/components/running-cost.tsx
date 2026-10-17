"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { saveEntry, setEntryOneOff } from "@/app/actions/ledger";
import { cn } from "@/lib/utils";

type Method = "cash" | "bank" | "qr";
const METHODS: [Method, string][] = [["cash", "Cash"], ["qr", "QR / eSewa"], ["bank", "Bank"]];

/** Running cost → "Add a day's sales": one money-in entry in the day-sales category, without opening the full form. */
export function DaySalesForm({ categoryId, categoryName, today }: { categoryId: string; categoryName: string; today: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState<Method>("cash");
  const [pending, start] = useTransition();

  const save = () => start(async () => {
    const r = await saveEntry(null, { kind: "in", amount, category_id: categoryId, occurred_on: date, method });
    if (r?.error) { toast.error(r.error); return; }
    toast.success(`${categoryName} saved`);
    setAmount("");
    router.refresh();
  });

  return (
    <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <label>
        <span className="label">Amount (Rs)</span>
        <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" required
          placeholder="e.g. 8500" className="input text-base sm:text-sm" />
      </label>
      <label>
        <span className="label">Date</span>
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required className="input text-base sm:text-sm" />
      </label>
      <div>
        <span className="label">Paid by</span>
        <div className="flex gap-1">
          {METHODS.map(([m, label]) => (
            <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m}
              className={cn("rounded-xl px-3 py-2.5 text-sm font-bold ring-1 transition",
                method === m ? "bg-brand-orange text-white ring-brand-orange" : "bg-white text-stone-600 ring-stone-200 hover:bg-stone-50")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <button disabled={pending || !amount} className="btn-primary !py-2.5">{pending ? "Saving…" : "Add"}</button>
    </form>
  );
}

/** One entry: counted as running money, or left out (a one-off buy / owners' money). */
export function RunningToggle({ id, counted, kind }: { id: string; counted: boolean; kind: "in" | "out" }) {
  const router = useRouter();
  const [value, setValue] = useState(counted);
  const [pending, start] = useTransition();
  const choose = (next: boolean) => {
    if (next === value) return;
    setValue(next);
    start(async () => {
      const r = await setEntryOneOff(id, !next);
      if (r?.error) { setValue(!next); toast.error(r.error); return; }
      router.refresh();
    });
  };
  const options: [boolean, string][] = kind === "out" ? [[true, "Running cost"], [false, "One-off"]] : [[true, "Trading income"], [false, "Not income"]];
  return (
    <div role="radiogroup" aria-label="Counts as running money?" className={cn("flex shrink-0 gap-0.5 rounded-full bg-stone-100 p-0.5", pending && "opacity-60")}>
      {options.map(([v, label]) => (
        <button key={label} type="button" role="radio" aria-checked={value === v} disabled={pending} onClick={() => choose(v)}
          className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold transition",
            value === v ? (v ? "bg-white text-green-700 shadow-sm" : "bg-white text-stone-700 shadow-sm") : "text-stone-500")}>
          {label}
        </button>
      ))}
    </div>
  );
}
