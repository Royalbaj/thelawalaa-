"use client";
import Link from "next/link";
import { GraduationCap, LogOut } from "lucide-react";
import { signOutHere } from "@/lib/sign-out";
import OrderAlertsButton from "@/components/pos/order-alerts";
import RefreshButton from "@/components/refresh-button";
import BrandLogo, { BrandMark } from "@/components/brand-logo";
import DaySalesButton from "@/components/pos/day-sales-sheet";
import StockButton from "@/components/pos/stock-sheet";

// pos_user only reaches this header now — super_admin no longer shares
// the POS terminal, so there's no "back to dashboard" link to show here.
export default function PosHeader({ fullName }: { fullName: string }) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-orange-900/20 bg-brand-dark px-4 py-2.5 text-white">
      {/* Phones: just the TW tile, so all the buttons fit on one row. */}
      <BrandMark size={30} className="sm:hidden" />
      <BrandLogo size="sm" tone="dark" label="POS" className="hidden sm:inline-flex" />
      <div className="flex items-center gap-1.5">
        <span className="hidden text-xs font-bold text-white/60 lg:inline">{fullName}</span>
        {/* Today's sales + the end-of-shift cash count. */}
        <DaySalesButton />
        {/* Every stock item and what's left — look only. */}
        <StockButton />
        {/* Fetches orders, menu and stock again — the cart being built is kept. */}
        <RefreshButton className="h-8 w-8 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-100" />
        <OrderAlertsButton />
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
