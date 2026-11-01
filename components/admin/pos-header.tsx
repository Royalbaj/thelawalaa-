"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { GraduationCap } from "lucide-react";
import OrderAlertsButton from "@/components/pos/order-alerts";
import RefreshButton from "@/components/refresh-button";
import BrandLogo, { BrandMark } from "@/components/brand-logo";
import DaySalesButton from "@/components/pos/day-sales-sheet";
import StockButton from "@/components/pos/stock-sheet";
import TimeClockButton from "@/components/pos/time-clock";
import StaffMenu from "@/components/pos/staff-menu";
import PosSignOutButton from "@/components/pos/pos-sign-out";
import OutletButton from "@/components/pos/outlet-sheet";
import PosRoleWatch from "@/components/pos/pos-role-watch";
import { NOTE_FEATURES, STOCK_FEATURES, posRoleStamp, type PosFeature } from "@/lib/pos-features";
import { cn } from "@/lib/utils";

/** One cluster of related buttons — a soft pill from `sm`, just a tight row on phones. */
function Group({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("flex items-center gap-1 sm:rounded-full sm:bg-white/[0.06] sm:p-1", className)}>
      {children}
    </div>
  );
}

// pos_user only reaches this header now — super_admin no longer shares
// the POS terminal, so there's no "back to dashboard" link to show here.
// Three groups, always in this order, so nothing is hunted for:
//   1. who's on — the person on the till (name menu: Log out, training, full
//      sign-out) and Clock (clock in / out, once a shift; in the name menu on phones);
//   2. the day's work — Today (sales, close shift), Stock (levels, and add /
//      waste / recount for roles that allow it), Outlet (day expenses, issues);
//   3. this device — Refresh, order alerts, Staff training, Sign out of the POS
//      (the last two are in the name menu on phones).
// staff.features: what their POS role allows (Admin → POS team & roles) — a
// change there shows here within a minute (PosRoleWatch), no new login needed.
export default function PosHeader({ fullName, staff }: {
  fullName: string;
  staff?: { name: string; clockedInSince: string | null; role: string | null; features: PosFeature[] } | null;
}) {
  const stock = staff ? staff.features.filter((f) => STOCK_FEATURES.includes(f)) : [];
  const notes = staff ? staff.features.filter((f) => NOTE_FEATURES.includes(f)) : [];
  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-orange-900/20 bg-brand-dark px-4 py-2.5 text-white">
      <PosRoleWatch stamp={posRoleStamp(staff)} />
      {/* Phones and iPad portrait: just the TW tile, so all the buttons fit on one row. */}
      <BrandMark size={30} className="shrink-0 lg:hidden" />
      <BrandLogo size="sm" tone="dark" label="POS" className="hidden shrink-0 lg:inline-flex" />
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
        <Group label="Who's on">
          {staff ? (
            <StaffMenu name={staff.name} clockedInSince={staff.clockedInSince} role={staff.role} />
          ) : (
            <span className="hidden px-2 text-xs font-bold text-white/60 lg:inline">{fullName}</span>
          )}
          <span className={staff ? "hidden sm:flex" : "flex"}><TimeClockButton /></span>
        </Group>
        <Group label="Today's work">
          <DaySalesButton countedBy={staff?.name} canClose={!staff || staff.features.includes("close_shift")} />
          <StockButton features={stock} />
          {notes.length > 0 && <OutletButton features={notes} />}
        </Group>
        <Group label="This device">
          {/* Fetches orders, menu and stock again — the cart being built is kept. */}
          <RefreshButton className="h-8 w-8 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white disabled:opacity-100" />
          <OrderAlertsButton />
          <Link href="/staff" aria-label="Staff Portal" title="Staff training" className={cn(staff ? "hidden sm:flex" : "flex", "h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white")}>
            <GraduationCap size={15} />
          </Link>
          <span className={staff ? "hidden sm:flex" : "flex"}><PosSignOutButton variant="icon" /></span>
        </Group>
      </div>
    </header>
  );
}
