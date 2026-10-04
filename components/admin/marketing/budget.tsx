"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Copy, PiggyBank, X } from "lucide-react";
import { saveMarketingBudget, saveMarketingSettings } from "@/app/actions/marketing";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "@/lib/marketing-shared";

type Budget = { total: number | null; byCategory: Partial<Record<Category, number>> };
const str = (n: number | null | undefined) => (n == null ? "" : String(n));

/** "Set budget" for the month: the overall amount, and optionally per category. */
export function BudgetButton({ ym, label, budget, prevBudget, prevLabel }: { ym: string; label: string; budget: Budget; prevBudget: Budget; prevLabel: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [total, setTotal] = useState(str(budget.total));
  const [cats, setCats] = useState<Record<string, string>>(Object.fromEntries(CATEGORY_KEYS.map((c) => [c, str(budget.byCategory[c])])));
  const hasPrev = prevBudget.total != null || Object.keys(prevBudget.byCategory).length > 0;
  const catSum = CATEGORY_KEYS.reduce((s, c) => s + (Number(cats[c]) || 0), 0);

  const copyPrev = () => {
    setTotal(str(prevBudget.total));
    setCats(Object.fromEntries(CATEGORY_KEYS.map((c) => [c, str(prevBudget.byCategory[c])])));
  };
  const save = () => start(async () => {
    const r = await saveMarketingBudget({
      month: ym,
      total: total ? Number(total) : null,
      categories: Object.fromEntries(CATEGORY_KEYS.map((c) => [c, cats[c] ? Number(cats[c]) : null])),
    });
    if ("error" in r && r.error) { toast.error(r.error); return; }
    toast.success(`Budget for ${label} saved`);
    setOpen(false);
    router.refresh();
  });

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary !px-5 !py-2.5 text-sm"><PiggyBank size={16} /> {budget.total != null ? "Edit budget" : "Set budget"}</button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Marketing budget">
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-brand-brown">Marketing budget · {label}</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100"><X size={18} /></button>
            </div>
            {hasPrev && (
              <button onClick={copyPrev} className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold text-brand-orange ring-1 ring-orange-200 hover:bg-orange-50">
                <Copy size={13} /> Copy {prevLabel}&apos;s budget
              </button>
            )}
            <label className="label" htmlFor="b-total">Total for the month (Rs)</label>
            <input id="b-total" className="input" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, ""))} placeholder="e.g. 10000" />
            <p className="mt-4 text-sm font-bold text-stone-700">By category <span className="font-normal text-stone-400">(optional)</span></p>
            <div className="mt-2 space-y-2">
              {CATEGORY_KEYS.map((c) => (
                <label key={c} className="flex items-center justify-between gap-3 text-sm text-stone-600">
                  <span className="min-w-0 flex-1 truncate">{CATEGORIES[c]}</span>
                  <input className="input !w-28 !py-1.5 text-right" inputMode="numeric" value={cats[c]} placeholder="—"
                    onChange={(e) => setCats((x) => ({ ...x, [c]: e.target.value.replace(/[^\d.]/g, "") }))} aria-label={`${CATEGORIES[c]} budget`} />
                </label>
              ))}
            </div>
            {catSum > 0 && total && catSum > Number(total) && (
              <p className="mt-2 text-xs font-bold text-amber-700">The categories add up to Rs {catSum.toLocaleString("en-IN")} — more than the total.</p>
            )}
            <p className="mt-3 text-xs text-stone-500">Leave a box empty for no budget. Each month has its own budget.</p>
            <button onClick={save} disabled={pending} className="btn-primary mt-4 w-full">{pending ? "Saving…" : "Save budget"}</button>
          </div>
        </div>
      )}
    </>
  );
}

/** Gross margin — only for "profit ROI" and the planner. */
export function MarginForm({ margin }: { margin: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [m, setM] = useState(String(margin));
  return (
    <form className="flex items-end gap-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await saveMarketingSettings({ gross_margin_pct: Number(m) });
        if ("error" in r && r.error) toast.error(r.error); else { toast.success("Saved"); router.refresh(); }
      });
    }}>
      <div className="flex-1"><label className="label" htmlFor="s-margin">Gross margin %</label>
        <input id="s-margin" className="input" inputMode="decimal" value={m} onChange={(e) => setM(e.target.value.replace(/[^\d.]/g, ""))} /></div>
      <button disabled={pending} className="rounded-full px-5 py-2.5 text-sm font-bold text-brand-brown ring-1 ring-stone-200 hover:bg-stone-50">{pending ? "…" : "Save"}</button>
    </form>
  );
}
