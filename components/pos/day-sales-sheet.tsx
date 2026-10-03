"use client";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Calculator, X, RefreshCw, AlertTriangle, CheckCircle2, Banknote, QrCode, Smartphone, Store, Globe, Minus, Plus, History } from "lucide-react";
import { getDaySales, closeShift } from "@/app/actions/pos";
import type { DaySales } from "@/lib/day-sales";
import { npr, cn } from "@/lib/utils";

const NOTES = ["1000", "500", "100", "50", "20", "10", "5"] as const;
const FLOAT_KEY = "tw-pos-float"; // this till's usual opening float — a business number, not personal data
const METHOD = { cash: { label: "Cash", icon: Banknote }, qr: { label: "QR", icon: QrCode }, esewa: { label: "eSewa", icon: Smartphone } } as Record<string, { label: string; icon: typeof Banknote }>;
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit", hour12: true });
const num = (v: string) => Math.max(0, Math.floor(Number(v.replace(/[^\d]/g, "")) || 0));

/** POS header button → today's sales and the end-of-shift cash count. */
export default function DaySalesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Today's sales and cash count" title="Today's sales · close shift"
        className="flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-2.5 text-xs font-bold text-white/80 transition hover:bg-white/20 hover:text-white">
        <Calculator size={15} /> <span className="hidden sm:inline">Today</span>
      </button>
      {open && <DaySalesSheet onClose={() => setOpen(false)} />}
    </>
  );
}

export function DaySalesSheet({ onClose, initial }: { onClose: () => void; initial?: DaySales }) {
  const [period, setPeriod] = useState<"day" | "shift">("day");
  const [data, setData] = useState<DaySales | null>(initial ?? null);
  const [loadError, setLoadError] = useState(false);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const [float, setFloat] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [coins, setCoins] = useState("");
  const [countedBy, setCountedBy] = useState("");

  const load = useCallback((p: "day" | "shift") => startLoad(async () => {
    try { setData(await getDaySales(p)); setLoadError(false); } catch { setLoadError(true); }
  }), []);
  useEffect(() => { if (!initial || period !== "day") load(period); }, [load, period, initial]);
  useEffect(() => { try { setFloat(localStorage.getItem(FLOAT_KEY) ?? ""); } catch { /* storage blocked */ } }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const counted = useMemo(() => NOTES.reduce((s, n) => s + Number(n) * (counts[n] ?? 0), 0) + num(coins), [counts, coins]);
  const anyCounted = counted > 0;
  const expected = (data?.cashReceived ?? 0) + num(float);
  const diff = counted - expected;
  const problems = data?.problems.reduce((n, p) => n + p.orders.length, 0) ?? 0;

  const bump = (n: string, by: number) => setCounts((c) => ({ ...c, [n]: Math.max(0, (c[n] ?? 0) + by) }));

  const save = () => {
    if (!data) return;
    const verdict = Math.abs(diff) < 1 ? "balanced" : diff < 0 ? `SHORT by ${npr(-diff)}` : `OVER by ${npr(diff)}`;
    if (!confirm(`Close the shift? The drawer is ${verdict}.${problems ? `\n\n${problems} order(s) still need checking.` : ""}`)) return;
    startSave(async () => {
      const r = await closeShift({
        period, opening_float: num(float), counted_by: countedBy || undefined,
        counts: { ...Object.fromEntries(NOTES.map((n) => [n, counts[n] ?? 0])), coins: num(coins) },
      });
      if ("error" in r && r.error) { toast.error(r.error); return; }
      try { localStorage.setItem(FLOAT_KEY, String(num(float))); } catch { /* storage blocked */ }
      const res = r as { difference: number };
      toast.success(Math.abs(res.difference) < 1 ? "Shift closed — the drawer balances ✓" : `Shift closed — ${res.difference < 0 ? "short" : "over"} by ${npr(Math.abs(res.difference))}`, { duration: 6000 });
      setCounts({}); setCoins("");
      setPeriod("shift");
      load("shift");
    });
  };

  const card = "rounded-2xl bg-white p-4 ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800";
  const muted = "text-stone-500 dark:text-stone-400";

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/60 lg:items-center lg:p-6" role="dialog" aria-modal="true" aria-label="Today's sales">
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-brand-cream text-stone-900 [&_input]:select-text dark:bg-stone-950 dark:text-stone-100 lg:h-[92dvh] lg:rounded-3xl lg:shadow-2xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}>
        {/* Top bar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900">
          <div className="min-w-0">
            <p className="font-display text-lg font-extrabold text-brand-brown dark:text-orange-100">Today&apos;s sales &amp; cash count</p>
            <p className={cn("text-xs", muted)}>{data ? `${data.periodLabel} · paid, not-cancelled orders` : "Loading…"}</p>
          </div>
          <div className="flex items-center gap-2">
            {!!data?.closes.length && (
              <div className="flex rounded-full bg-stone-100 p-1 dark:bg-stone-800">
                {(["day", "shift"] as const).map((p) => (
                  <button key={p} onClick={() => setPeriod(p)}
                    className={cn("rounded-full px-3 py-1.5 text-xs font-bold", period === p ? "bg-brand-orange text-white" : muted)}>
                    {p === "day" ? "Whole day" : "This shift"}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => load(period)} aria-label="Refresh" className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
              <RefreshCw size={16} className={cn(loading && "animate-spin")} />
            </button>
            <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800"><X size={18} /></button>
          </div>
        </div>

        {/* Everything scrolls; the cash result below stays pinned */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {loadError && <p className="mb-4 rounded-2xl bg-red-50 p-4 text-sm font-bold text-brand-red dark:bg-red-950/40">Couldn&apos;t load today&apos;s sales — check the connection and tap refresh.</p>}
          {!data && !loadError && <p className={cn("py-16 text-center text-sm font-bold", muted)}>Adding up today…</p>}
          {data && (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Sales", value: npr(data.sales), tint: "text-brand-green" },
                    { label: "Orders", value: String(data.orders), tint: "" },
                    { label: "Still to collect", value: npr(data.toCollect.amount), sub: `${data.toCollect.count} unpaid`, tint: data.toCollect.count ? "text-amber-600" : "" },
                    { label: "Discounts given", value: npr(data.discounts), tint: "" },
                  ].map((t) => (
                    <div key={t.label} className={card}>
                      <p className={cn("text-[11px] font-bold uppercase tracking-wide", muted)}>{t.label}</p>
                      <p className={cn("mt-1 font-display text-xl font-extrabold", t.tint)}>{t.value}</p>
                      {t.sub && <p className={cn("text-[11px]", muted)}>{t.sub}</p>}
                    </div>
                  ))}
                </div>

                <div className={card}>
                  <p className="mb-2 text-sm font-bold">How it was paid</p>
                  <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                    {data.byMethod.length === 0 && <li className={cn("py-2 text-sm", muted)}>No paid orders yet.</li>}
                    {data.byMethod.map((m) => {
                      const meta = METHOD[m.method] ?? { label: m.method, icon: Banknote };
                      return (
                        <li key={m.method} className="flex items-center gap-3 py-2.5">
                          <meta.icon size={18} className="text-brand-orange" />
                          <span className="flex-1 text-sm font-bold">{meta.label} <span className={cn("font-normal", muted)}>· {m.count} order{m.count === 1 ? "" : "s"}</span></span>
                          <span className="font-display font-extrabold">{npr(m.amount)}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-2 grid grid-cols-2 gap-2 border-t border-stone-100 pt-3 text-sm dark:border-stone-800">
                    <p className="flex items-center gap-2"><Store size={15} className={muted} /> Counter <b className="ml-auto">{npr(data.counter.amount)}</b></p>
                    <p className="flex items-center gap-2"><Globe size={15} className={muted} /> Online <b className="ml-auto">{npr(data.online.amount)}</b></p>
                  </div>
                </div>

                <div className={card}>
                  <p className="mb-2 text-sm font-bold">Checks before you count</p>
                  {data.problems.length === 0 ? (
                    <p className="flex items-center gap-2 text-sm font-bold text-brand-green"><CheckCircle2 size={17} /> Nothing looks wrong.</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {data.problems.map((p) => (
                        <li key={p.kind} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                          <p className="flex items-start gap-2 font-bold"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {p.label}</p>
                          <p className="mt-1 pl-6 font-mono text-xs">{p.orders.slice(0, 20).join(", ")}{p.orders.length > 20 ? ` +${p.orders.length - 20} more` : ""}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  {data.cancelled > 0 && <p className={cn("mt-2 text-xs", muted)}>{data.cancelled} cancelled order{data.cancelled === 1 ? "" : "s"} not counted.</p>}
                </div>

                {data.topItems.length > 0 && (
                  <div className={card}>
                    <p className="mb-2 text-sm font-bold">Sold most</p>
                    <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                      {data.topItems.map((i) => <li key={i.name} className="flex justify-between gap-3"><span className="truncate">{i.name}</span><b>{i.qty}</b></li>)}
                    </ul>
                  </div>
                )}

                {data.closes.length > 0 && (
                  <div className={card}>
                    <p className="mb-2 flex items-center gap-2 text-sm font-bold"><History size={15} /> Shift closes today</p>
                    <ul className="space-y-1.5 text-sm">
                      {data.closes.map((c) => (
                        <li key={c.at} className="flex flex-wrap items-center justify-between gap-2">
                          <span>{time(c.at)}{c.counted_by ? ` · ${c.counted_by}` : ""}</span>
                          <span className={cn("font-bold", Math.abs(c.difference) < 1 ? "text-brand-green" : c.difference < 0 ? "text-brand-red" : "text-amber-600")}>
                            {Math.abs(c.difference) < 1 ? "Balanced" : c.difference < 0 ? `Short ${npr(-c.difference)}` : `Over ${npr(c.difference)}`}
                            <span className={cn("ml-1 font-normal", muted)}>(counted {npr(c.counted_cash)})</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Cash count */}
              <div className={cn(card, "h-fit space-y-3")}>
                <p className="text-sm font-bold">Count the cash drawer</p>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>Opening float <span className={cn("block text-[11px]", muted)}>cash in the drawer at the start</span></span>
                  <input value={float} onChange={(e) => setFloat(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="0"
                    className="input !w-28 text-right" aria-label="Opening float" />
                </label>
                <div className="divide-y divide-stone-100 border-y border-stone-100 dark:divide-stone-800 dark:border-stone-800">
                  {NOTES.map((n) => (
                    <div key={n} className="flex items-center gap-2 py-1.5">
                      <span className="w-16 text-sm font-bold">Rs {n}</span>
                      <button onClick={() => bump(n, -1)} aria-label={`One less Rs ${n} note`} className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800"><Minus size={15} /></button>
                      <input value={counts[n] ? String(counts[n]) : ""} onChange={(e) => setCounts((c) => ({ ...c, [n]: num(e.target.value) }))}
                        inputMode="numeric" placeholder="0" aria-label={`Number of Rs ${n} notes`} className="input !w-16 !px-2 text-center" />
                      <button onClick={() => bump(n, 1)} aria-label={`One more Rs ${n} note`} className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800"><Plus size={15} /></button>
                      <span className={cn("ml-auto text-sm tabular-nums", muted)}>{counts[n] ? npr(Number(n) * counts[n]) : ""}</span>
                    </div>
                  ))}
                  <label className="flex items-center gap-2 py-1.5">
                    <span className="w-16 text-sm font-bold">Coins</span>
                    <input value={coins} onChange={(e) => setCoins(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" placeholder="Rs total"
                      aria-label="Coins total in rupees" className="input !w-28 text-center" />
                  </label>
                </div>
                <input value={countedBy} onChange={(e) => setCountedBy(e.target.value.slice(0, 40))} placeholder="Counted by (name)" aria-label="Counted by" className="input" />
              </div>
            </div>
          )}
        </div>

        {/* Pinned result */}
        {data && (
          <div className="shrink-0 border-t border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="text-sm">
                <p className={muted}>Should be in drawer</p>
                <p className="font-display text-lg font-extrabold">{npr(expected)}</p>
                <p className={cn("text-[11px]", muted)}>float {npr(num(float))} + cash taken {npr(data.cashReceived)}</p>
              </div>
              <div className="text-sm">
                <p className={muted}>Counted</p>
                <p className="font-display text-lg font-extrabold">{npr(counted)}</p>
              </div>
              <div className={cn("rounded-2xl px-4 py-2 text-sm font-extrabold",
                !anyCounted ? "bg-stone-100 text-stone-500 dark:bg-stone-800" : Math.abs(diff) < 1 ? "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300" : diff < 0 ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300")}>
                {!anyCounted ? "Count the notes above" : Math.abs(diff) < 1 ? "✓ Balanced" : diff < 0 ? `Short ${npr(-diff)}` : `Over ${npr(diff)}`}
              </div>
              <button onClick={save} disabled={saving || !anyCounted} className="btn-primary ml-auto !py-3">
                {saving ? "Saving…" : "Close shift"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
