"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Clock, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { checkClockPin, getClockBoard, punchClock } from "@/app/actions/time-clock";
import PinPad from "@/components/pin-pad";
import { REFRESH_EVENT } from "@/components/refresh-button";
import { cn } from "@/lib/utils";

// The POS login is shared, so each counter person clocks in and out with
// their own PIN (the same one as training). The counter sees names and
// clock times only — hours worked are for the manager (Admin → Staff Hours).
// Once staff log in to the till with their PIN (components/pos/pos-lock-screen.tsx),
// this sheet lives in the name menu: it clocks anyone in or out without
// changing who's on the till — unless it's the till's own person clocking out.

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit", hour12: true });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Kathmandu", weekday: "short", day: "numeric", month: "short" });

type Board = { name: string; since: string }[];
type Step =
  | { kind: "pin" }
  | { kind: "who"; pin: string; name: string; clockedIn: boolean; since: string | null; missedSince: string | null }
  | { kind: "done"; name: string; action: "in" | "out"; at: string; loggedOut: boolean };

/** POS header → "Clock": who's on, and the PIN pad to clock in or out. */
export default function TimeClockButton() {
  const [open, setOpen] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const load = useCallback(() => { getClockBoard().then(setBoard).catch(() => { /* offline — keep the last list */ }); }, []);
  useEffect(() => {
    load();
    window.addEventListener(REFRESH_EVENT, load);
    return () => window.removeEventListener(REFRESH_EVENT, load);
  }, [load]);

  return (
    <>
      <button onClick={() => { setOpen(true); load(); }} aria-label="Clock in or out" title="Clock in / out"
        className="flex h-8 items-center gap-1.5 rounded-full bg-white/10 px-2.5 text-xs font-bold text-white/80 transition hover:bg-white/20 hover:text-white">
        <Clock size={15} /> <span className="hidden sm:inline">Clock</span>
        {!!board?.length && (
          <span className="min-w-4 rounded-full bg-brand-green px-1 text-center text-[10px] font-extrabold leading-4 text-white" title={`${board.length} clocked in`}>
            {board.length}
          </span>
        )}
      </button>
      {open && <TimeClockSheet onChanged={load} onClose={() => setOpen(false)} />}
    </>
  );
}

export function TimeClockSheet({ onChanged, onClose }: { onChanged?: () => void; onClose: () => void }) {
  const [step, setStep] = useState<Step>({ kind: "pin" });
  const [board, setBoard] = useState<Board | null>(null);
  const [pending, start] = useTransition();
  const load = useCallback(() => { getClockBoard().then(setBoard).catch(() => { /* offline — keep the last list */ }); }, []);
  useEffect(load, [load]);
  // The till's own person clocked out: it locks (full load — back to the PIN screen).
  const finish = useCallback(() => {
    if (step.kind === "done" && step.loggedOut) window.location.replace("/admin");
    else onClose();
  }, [step, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);
  // A typed PIN never waits on a shared screen: back to the keypad after 30 s. The "done" note closes itself.
  useEffect(() => {
    if (step.kind === "pin") return;
    const t = setTimeout(() => (step.kind === "done" ? finish() : setStep({ kind: "pin" })), step.kind === "done" ? 4000 : 30_000);
    return () => clearTimeout(t);
  }, [step, finish]);

  const submitPin = useCallback(async (pin: string) => {
    const r = await checkClockPin(pin);
    if ("error" in r) return r.error;
    setStep({ kind: "who", pin, name: r.name, clockedIn: r.clockedIn, since: r.since, missedSince: r.missedSince });
    return null;
  }, []);

  const punch = (action: "in" | "out") => {
    if (step.kind !== "who") return;
    start(async () => {
      const r = await punchClock(step.pin, action).catch(() => ({ error: "No connection — try again" }));
      if ("error" in r) { toast.error(r.error); return; }
      setStep({ kind: "done", name: r.name, action: r.action, at: r.at, loggedOut: r.loggedOut });
      load();
      onChanged?.();
    });
  };

  const muted = "text-stone-500 dark:text-stone-400";
  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/60 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Clock in or out">
      <div className="flex h-full w-full max-w-md flex-col overflow-hidden bg-brand-cream text-stone-900 dark:bg-stone-950 dark:text-stone-100 sm:h-auto sm:max-h-[92dvh] sm:rounded-3xl sm:shadow-2xl"
        style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900">
          <div className="min-w-0">
            <p className="font-display text-lg font-extrabold text-brand-brown dark:text-orange-100">Clock in / out</p>
            <p className={cn("text-xs", muted)}>Use your own PIN — the same one as training.</p>
          </div>
          <button onClick={finish} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
          <div className="mb-4">
            <p className={cn("mb-1.5 text-[11px] font-extrabold uppercase tracking-wider", muted)}>On the clock now</p>
            {board === null ? (
              <p className={cn("text-sm", muted)}>Loading…</p>
            ) : board.length === 0 ? (
              <p className={cn("text-sm", muted)}>Nobody is clocked in.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {board.map((b) => (
                  <li key={b.name + b.since} className="rounded-full bg-white px-3 py-1.5 text-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
                    <span className="font-bold">{b.name}</span> <span className={muted}>since {time(b.since)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl bg-white p-5 text-center ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
            {step.kind === "pin" && (
              <>
                <p className="font-display text-lg font-bold text-brand-brown dark:text-orange-100">Who&apos;s this?</p>
                <PinPad submit={submitPin} idle="Type your 4-digit PIN" />
              </>
            )}

            {step.kind === "who" && (
              <div className="py-2">
                <p className="font-display text-2xl font-extrabold text-brand-brown dark:text-orange-100">{step.name}</p>
                <p className={cn("mt-1 text-sm", muted)}>
                  {step.clockedIn && step.since ? `Clocked in at ${time(step.since)}` : "Not clocked in"}
                </p>
                {step.missedSince && (
                  <p className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-left text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <span>You didn&apos;t clock out on {day(step.missedSince)} (in at {time(step.missedSince)}). The manager will put in that time.</span>
                  </p>
                )}
                <button onClick={() => punch(step.clockedIn ? "out" : "in")} disabled={pending}
                  className={cn("mt-5 h-16 w-full touch-manipulation rounded-2xl font-display text-xl font-extrabold text-white transition active:scale-[0.98] disabled:opacity-60",
                    step.clockedIn ? "bg-brand-red" : "bg-brand-green")}>
                  {pending ? "Saving…" : step.clockedIn ? "Clock out" : "Clock in"}
                </button>
                <button onClick={() => setStep({ kind: "pin" })} disabled={pending} className={cn("mt-3 py-2 text-sm font-bold", muted)}>
                  Not {step.name}? Go back
                </button>
              </div>
            )}

            {step.kind === "done" && (
              <div className="py-4">
                <CheckCircle2 size={40} className={cn("mx-auto", step.action === "in" ? "text-brand-green" : "text-brand-orange")} />
                <p className="mt-3 font-display text-xl font-extrabold">{step.name} clocked {step.action}</p>
                <p className="mt-1 font-display text-4xl font-extrabold tabular-nums text-brand-brown dark:text-orange-100">{time(step.at)}</p>
                <p className={cn("mt-2 text-sm", muted)}>
                  {step.action === "in" ? "Have a good shift." : step.loggedOut ? "Thanks — see you next time. The till is locked now." : "Thanks — see you next time."}
                </p>
                <button onClick={finish} className="btn-primary mt-5 w-full !py-3">Done</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
