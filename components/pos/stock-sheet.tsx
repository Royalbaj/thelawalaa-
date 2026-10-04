"use client";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Boxes, X, RefreshCw, Search, Lock } from "lucide-react";
import { getPosStock } from "@/app/actions/pos";
import type { PosStock, StockLevel } from "@/lib/stock-alerts";
import { cn } from "@/lib/utils";

const STATE = {
  out: { label: "Out", tint: "bg-red-100 text-brand-red dark:bg-red-950/60 dark:text-red-300" },
  low: { label: "Low", tint: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  ok: { label: "OK", tint: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300" },
} as const;
const counted = (iso: string | null) => iso
  ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })
  : "never";

/** POS header → "Stock": what's left of everything. Look only — counting and restocking happen in Accounts → Stock. */
export default function StockButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Stock levels" title="Stock levels"
        className="flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-2.5 text-xs font-bold text-white/80 transition hover:bg-white/20 hover:text-white">
        <Boxes size={15} /> <span className="hidden sm:inline">Stock</span>
      </button>
      {open && <StockSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function Row({ s }: { s: StockLevel }) {
  const pctLeft = s.reorder > 0 ? Math.min(1, s.remaining / (s.reorder * 3)) : s.remaining > 0 ? 1 : 0;
  return (
    <li className="rounded-2xl bg-white p-3.5 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">{s.name}</p>
          {s.products.length > 0 && <p className="truncate text-xs text-stone-500 dark:text-stone-400">For: {s.products.join(", ")}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("font-display text-xl font-extrabold tabular-nums", s.state === "out" ? "text-brand-red" : s.state === "low" ? "text-amber-600 dark:text-amber-400" : "")}>
            {s.remaining} <span className="text-xs font-bold text-stone-500 dark:text-stone-400">{s.unit}</span>
          </p>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase", STATE[s.state].tint)}>{STATE[s.state].label}</span>
        </div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-stone-100 dark:bg-stone-800">
        <div className={cn("h-1.5 rounded-full", s.state === "out" ? "bg-brand-red" : s.state === "low" ? "bg-amber-500" : "bg-brand-green")} style={{ width: `${Math.max(s.remaining > 0 ? 4 : 0, pctLeft * 100)}%` }} />
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-stone-500 dark:text-stone-400">
        <span>Warns at {s.reorder} {s.unit}</span>
        <span>Sold today {s.soldToday}</span>
        <span>Counted {counted(s.countedAt)}</span>
      </p>
    </li>
  );
}

export function StockSheet({ onClose, initial }: { onClose: () => void; initial?: PosStock }) {
  const [data, setData] = useState<PosStock | null>(initial ?? null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [loading, start] = useTransition();
  const load = useCallback(() => start(async () => {
    try { setData(await getPosStock()); setFailed(false); } catch { setFailed(true); }
  }), []);
  useEffect(() => { if (!initial) load(); }, [load, initial]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.all ?? []).filter((s) => !term || s.name.toLowerCase().includes(term) || s.products.some((p) => p.toLowerCase().includes(term)));
  }, [data, q]);
  const counts = { out: data?.all.filter((s) => s.state === "out").length ?? 0, low: data?.all.filter((s) => s.state === "low").length ?? 0 };

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/60 lg:items-center lg:p-6" role="dialog" aria-modal="true" aria-label="Stock levels">
      <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden bg-brand-cream text-stone-900 [&_input]:select-text dark:bg-stone-950 dark:text-stone-100 lg:h-[88dvh] lg:rounded-3xl lg:shadow-2xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900">
          <div className="min-w-0">
            <p className="font-display text-lg font-extrabold text-brand-brown dark:text-orange-100">Stock</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {data ? `${data.all.length} items${counts.out ? ` · ${counts.out} out` : ""}${counts.low ? ` · ${counts.low} low` : ""}` : "Loading…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} aria-label="Refresh" className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800"><RefreshCw size={16} className={cn(loading && "animate-spin")} /></button>
            <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800"><X size={18} /></button>
          </div>
        </div>
        <div className="shrink-0 px-4 pt-3">
          <label className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 dark:border-stone-700 dark:bg-stone-900">
            <Search size={16} className="text-stone-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an item…" aria-label="Find a stock item"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none sm:text-sm" />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
          {failed && <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-brand-red dark:bg-red-950/40">Couldn&apos;t load stock — check the connection and tap refresh.</p>}
          {data && data.all.length === 0 && <p className="py-12 text-center text-sm text-stone-500">No stock items yet — they&apos;re added in the Accounts app.</p>}
          {data && data.all.length > 0 && rows.length === 0 && <p className="py-12 text-center text-sm text-stone-500">Nothing matches &ldquo;{q}&rdquo;.</p>}
          <ul className="grid gap-2.5 sm:grid-cols-2">{rows.map((s) => <Row key={s.id} s={s} />)}</ul>
          {data && data.all.length > 0 && (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-stone-500 dark:text-stone-400">
              <Lock size={12} /> View only — stock is counted and restocked in the Accounts app.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
