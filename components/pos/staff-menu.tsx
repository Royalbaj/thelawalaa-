"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, GraduationCap, LogOut } from "lucide-react";
import { posStaffLogout } from "@/app/actions/time-clock";
import PosSignOutButton from "@/components/pos/pos-sign-out";
import { cn } from "@/lib/utils";

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit", hour12: true });

/**
 * POS header: who's on the till (logged in with their PIN). "Log out" hands
 * the till over — back to the PIN screen — and never touches their clock-in
 * (that's the Clock button, once a shift). An amber dot = not clocked in yet.
 * "Sign out of the POS" is the full one — the whole device (components/pos/pos-sign-out.tsx).
 * Logging out is a full page load, so the next person never sees the last one's screen.
 */
export default function StaffMenu({ name, clockedInSince }: { name: string; clockedInSince: string | null }) {
  const [open, setOpen] = useState(false);
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

  const logout = () => start(async () => {
    await posStaffLogout().catch(() => null);
    window.location.replace("/admin");
  });

  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left font-bold transition hover:bg-white/10 disabled:opacity-50";
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu"
        title={`${name} is on the till${clockedInSince ? "" : " (not clocked in)"}`}
        className="relative flex h-8 max-w-[8rem] items-center gap-1 rounded-full bg-brand-orange px-3 text-xs font-extrabold text-white transition hover:bg-orange-500">
        <span className="truncate">{name.split(" ")[0]}</span> <ChevronDown size={13} className="shrink-0" />
        {!clockedInSince && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-brand-dark" />}
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-10 z-[70] w-60 rounded-2xl bg-stone-900 p-1.5 text-sm text-stone-100 shadow-2xl ring-1 ring-stone-700">
          <div className="px-3 pb-2 pt-1.5">
            <p className="font-bold">{name}</p>
            <p className={cn("text-xs", clockedInSince ? "text-stone-400" : "text-amber-300")}>
              {clockedInSince ? `Clocked in at ${time(clockedInSince)}` : "Not clocked in — use the Clock button"}
            </p>
          </div>
          <button role="menuitem" onClick={logout} disabled={pending} className={cn(item, "bg-white/5")}>
            <LogOut size={16} className="shrink-0 text-orange-300" /> {pending ? "Logging out…" : "Log out"}
          </button>
          <Link role="menuitem" href="/staff" className={item}>
            <GraduationCap size={16} className="shrink-0 text-stone-400" /> Staff training
          </Link>
          <div className="my-1 border-t border-stone-700" />
          <PosSignOutButton variant="menu" />
        </div>
      )}
    </div>
  );
}
