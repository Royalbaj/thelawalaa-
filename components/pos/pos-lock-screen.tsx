"use client";
import { useCallback } from "react";
import { posStaffLogin } from "@/app/actions/time-clock";
import PinPad from "@/components/pin-pad";
import BrandLogo from "@/components/brand-logo";
import TimeClockButton from "@/components/pos/time-clock";
import PosSignOutButton from "@/components/pos/pos-sign-out";

// The till is locked until a counter person types their own PIN (the same one
// as training) — quick, every time they take over the till; their name goes on
// what they sell. Clocking in/out for their hours is separate and once a shift:
// the Clock button here and in the header.

export default function PosLockScreen() {
  const submit = useCallback(async (pin: string) => {
    const r = await posStaffLogin(pin);
    if ("error" in r) return r.error;
    // Full page load into the till — the header and orders come from the server with their name on.
    window.location.replace("/admin");
    return null;
  }, []);

  const muted = "text-stone-500 dark:text-stone-400";
  return (
    <main className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain px-4 py-6">
      <div className="my-auto w-full max-w-sm">
        <div className="mb-5 flex justify-center"><BrandLogo size="sm" tone="dark" label="POS" /></div>
        <div className="rounded-3xl bg-white p-6 text-center ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
          <p className="font-display text-xl font-bold text-brand-brown dark:text-orange-100">Who&apos;s on the till?</p>
          <p className={`text-sm ${muted}`}>Type your PIN to use the POS.</p>
          <PinPad submit={submit} idle="Your 4-digit PIN — same as training" />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <TimeClockButton label="Clock in / out"
            className="flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-stone-700 ring-1 ring-stone-200 transition hover:bg-stone-50 dark:bg-stone-900 dark:text-stone-200 dark:ring-stone-700 dark:hover:bg-stone-800" />
          {/* Closing time: the whole device signs out of the POS. */}
          <PosSignOutButton variant="lock" />
        </div>
      </div>
    </main>
  );
}
