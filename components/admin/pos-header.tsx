"use client";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import OrderAlertsButton from "@/components/pos/order-alerts";
import RefreshButton from "@/components/refresh-button";
import BrandLogo, { BrandMark } from "@/components/brand-logo";
import DaySalesButton from "@/components/pos/day-sales-sheet";
import StockButton from "@/components/pos/stock-sheet";
import TimeClockButton from "@/components/pos/time-clock";
import StaffMenu from "@/components/pos/staff-menu";
import PosSignOutButton from "@/components/pos/pos-sign-out";

// pos_user only reaches this header now — super_admin no longer shares
// the POS terminal, so there's no "back to dashboard" link to show here.
// `staff`: the person logged in to the till with their PIN (migration 037) —
// their name menu holds Log out (hand the till over), Staff training and the
// full "Sign out of the POS". The Clock button (clock in/out, once a shift) and
// the full sign-out (power icon; in the name menu on phones) are always here.
export default function PosHeader({ fullName, staff }: { fullName: string; staff?: { name: string; clockedInSince: string | null } | null }) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-orange-900/20 bg-brand-dark px-4 py-2.5 text-white">
      {/* Phones: just the TW tile, so all the buttons fit on one row. */}
      <BrandMark size={30} className="sm:hidden" />
      <BrandLogo size="sm" tone="dark" label="POS" className="hidden sm:inline-flex" />
      <div className="flex items-center gap-1.5">
        {staff ? (
          <StaffMenu name={staff.name} clockedInSince={staff.clockedInSince} />
        ) : (
          <span className="hidden text-xs font-bold text-white/60 lg:inline">{fullName}</span>
        )}
        {/* Each counter person clocks in / out with their own PIN — once a shift. */}
        <TimeClockButton />
        {/* Today's sales + the end-of-shift cash count. */}
        <DaySalesButton countedBy={staff?.name} />
        {/* Every stock item and what's left — look only. */}
        <StockButton />
        {/* Fetches orders, menu and stock again — the cart being built is kept. */}
        <RefreshButton className="h-8 w-8 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-100" />
        <OrderAlertsButton />
        {/* With someone logged in, phones find Staff training in their name menu (room for the Clock button). */}
        <Link href="/staff" aria-label="Staff Portal" className={`${staff ? "hidden sm:flex" : "flex"} h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white`}>
          <GraduationCap size={15} />
        </Link>
        {/* The whole device signs out of the POS (closing time). Phones with someone on the till: it's in the name menu. */}
        <span className={staff ? "hidden sm:flex" : "flex"}><PosSignOutButton variant="icon" /></span>
      </div>
    </header>
  );
}
