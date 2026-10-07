"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ChevronDown, Clock, Lock, LogOut } from "lucide-react";
import { posStaffLock, posStaffLogout } from "@/app/actions/time-clock";
import { TimeClockSheet } from "@/components/pos/time-clock";
import { signOutHere } from "@/lib/sign-out";

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit", hour12: true });

/**
 * POS header: who's on the till (logged in with their PIN). Lock = back to the
 * PIN screen, still clocked in; Clock out & log out = shift over. Every change
 * is a full page load, so the next person never sees the last one's screen.
 */
export default function StaffMenu({ name, since }: { name: string; since: string }) {
  const [open, setOpen] = useState(false);
  const [clock, setClock] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); window.removeEventListener("keydown", esc); };
  }, [open]);

  const lock = () => start(async () => {
    await posStaffLock().catch(() => null);
    window.location.replace("/admin");
  });
  const logout = () => {
    if (!confirm(`Clock ${name} out and log out of the till?`)) return;
    start(async () => {
      const r = await posStaffLogout().catch(() => null);
      if (!r) { toast.error("No connection — try again"); return; }
      window.location.replace("/admin");
    });
  };

  const item = "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/10 disabled:opacity-50";
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" title={`${name} is on the till`}
        className="flex h-8 max-w-[8rem] items-center gap-1 rounded-full bg-brand-orange px-3 text-xs font-extrabold text-white transition hover:bg-orange-500">
        <span className="truncate">{name.split(" ")[0]}</span> <ChevronDown size={13} className="shrink-0" />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-10 z-[70] w-64 rounded-2xl bg-stone-900 p-1.5 text-sm text-stone-100 shadow-2xl ring-1 ring-stone-700">
          <div className="px-3 pb-2 pt-1.5">
            <p className="font-bold">{name}</p>
            <p className="text-xs text-stone-400">Clocked in at {time(since)}</p>
          </div>
          <button role="menuitem" onClick={lock} disabled={pending} className={item}>
            <Lock size={16} className="mt-0.5 shrink-0 text-stone-400" />
            <span><span className="font-bold">Lock screen</span><span className="block text-xs text-stone-400">Stay clocked in — a break, or someone else&apos;s turn</span></span>
          </button>
          <button role="menuitem" onClick={logout} disabled={pending} className={item}>
            <LogOut size={16} className="mt-0.5 shrink-0 text-red-300" />
            <span><span className="font-bold text-red-300">Clock out &amp; log out</span><span className="block text-xs text-stone-400">Your shift is over</span></span>
          </button>
          <div className="my-1 border-t border-stone-700" />
          <button role="menuitem" onClick={() => { setOpen(false); setClock(true); }} className={item}>
            <Clock size={16} className="mt-0.5 shrink-0 text-stone-400" />
            <span><span className="font-bold">Clock someone in or out</span><span className="block text-xs text-stone-400">Without changing who&apos;s on the till</span></span>
          </button>
          <button role="menuitem" onClick={signOutHere} className={`${item} text-xs text-stone-400`}>
            Sign this device out of the POS
          </button>
        </div>
      )}
      {clock && <TimeClockSheet onClose={() => setClock(false)} />}
    </div>
  );
}
