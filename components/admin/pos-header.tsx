"use client";
import Link from "next/link";
import { GraduationCap, LogOut } from "lucide-react";
import { signOutHere } from "@/lib/sign-out";
import { PosThemeToggle } from "@/components/pos/pos-theme";

// pos_user only reaches this header now — super_admin no longer shares
// the POS terminal, so there's no "back to dashboard" link to show here.
export default function PosHeader({ fullName }: { fullName: string }) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-orange-900/20 bg-brand-dark px-4 py-2.5 text-white">
      <span className="font-display font-bold brand-gradient-text">Thelawalaa POS</span>
      <div className="flex items-center gap-1.5">
        <span className="hidden text-xs font-bold text-white/60 sm:inline">{fullName}</span>
        <PosThemeToggle />
        <Link href="/staff" aria-label="Staff Portal" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white">
          <GraduationCap size={15} />
        </Link>
        <button
          onClick={signOutHere}
          aria-label="Sign out"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-red-500/20 hover:text-red-300"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
}
