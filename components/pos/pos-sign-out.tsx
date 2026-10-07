"use client";
import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, Power } from "lucide-react";
import { getClockBoard, signOutPos } from "@/app/actions/time-clock";
import { signOutHere } from "@/lib/sign-out";
import { cn } from "@/lib/utils";

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit", hour12: true });

/**
 * The full POS sign-out (closing time, or handing the device in): logs out
 * whoever is on the till, can clock everyone out, and signs the POS login out
 * of this device — the POS email and password are needed to open it again.
 * Not the same as the name menu's "Log out", which only hands the till over.
 */
export default function PosSignOutButton({ variant }: { variant: "icon" | "menu" | "lock" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "icon" ? (
        <button onClick={() => setOpen(true)} aria-label="Sign out of the POS" title="Sign out of the POS"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-red-500/20 hover:text-red-300">
          <Power size={15} />
        </button>
      ) : variant === "menu" ? (
        <button role="menuitem" onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-bold text-red-300 transition hover:bg-red-500/10">
          <Power size={16} className="shrink-0" /> Sign out of the POS
        </button>
      ) : (
        <button onClick={() => setOpen(true)}
          className="flex h-12 items-center gap-2 rounded-full px-6 text-sm font-bold text-brand-red ring-1 ring-red-200 transition hover:bg-red-50 dark:text-red-300 dark:ring-red-900/70 dark:hover:bg-red-950/40">
          <Power size={15} /> Sign out of the POS
        </button>
      )}
      {open && <SignOutSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function SignOutSheet({ onClose }: { onClose: () => void }) {
  const [board, setBoard] = useState<{ name: string; since: string }[] | null>(null);
  const [clockOut, setClockOut] = useState(true); // closing time: nobody should stay on the clock
  const [pending, start] = useTransition();
  useEffect(() => { getClockBoard().then(setBoard).catch(() => setBoard([])); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !pending) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pending]);

  const go = () => start(async () => {
    const r = await signOutPos({ clockOutEveryone: clockOut && !!board?.length }).catch(() => null);
    if (!r) { toast.error("No connection — try again"); return; }
    await signOutHere(); // this device only, then the login page (a full load)
  });

  const muted = "text-stone-500 dark:text-stone-400";
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Sign out of the POS"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
      <div className="w-full max-w-md rounded-3xl bg-white p-5 text-left text-stone-900 shadow-2xl ring-1 ring-stone-200 dark:bg-stone-900 dark:text-stone-100 dark:ring-stone-800">
        <p className="font-display text-xl font-extrabold text-brand-brown dark:text-orange-100">Sign out of the POS?</p>
        <p className={cn("mt-1 text-sm", muted)}>
          This device leaves the POS completely. Whoever is on the till is logged out, and the POS email and password are needed to open it again.
        </p>

        <div className="mt-4">
          {board === null ? (
            <p className={cn("text-sm", muted)}>Checking who&apos;s clocked in…</p>
          ) : board.length === 0 ? (
            <p className={cn("text-sm", muted)}>Nobody is clocked in.</p>
          ) : (
            <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              <p className="flex items-center gap-2 font-bold"><AlertTriangle size={15} className="shrink-0" /> Still clocked in</p>
              <ul className="mt-1 space-y-0.5 pl-6">
                {board.map((b) => <li key={b.name + b.since}>{b.name} <span className="opacity-75">since {time(b.since)}</span></li>)}
              </ul>
              <label className="mt-3 flex items-center gap-2.5 font-bold">
                <input type="checkbox" checked={clockOut} onChange={(e) => setClockOut(e.target.checked)} className="h-5 w-5 accent-brand-orange" />
                Clock {board.length === 1 ? "them" : "them all"} out now
              </label>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button onClick={go} disabled={pending || board === null}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-red font-display text-lg font-extrabold text-white transition active:scale-[0.98] disabled:opacity-60">
            <Power size={18} /> {pending ? "Signing out…" : "Sign out of the POS"}
          </button>
          <button onClick={onClose} disabled={pending} className={cn("h-11 w-full rounded-2xl text-sm font-bold", muted)}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
