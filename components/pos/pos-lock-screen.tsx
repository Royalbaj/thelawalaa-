"use client";
import { useCallback, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { posStaffLogin } from "@/app/actions/time-clock";
import PinPad from "@/components/pin-pad";
import BrandLogo from "@/components/brand-logo";
import { signOutHere } from "@/lib/sign-out";

// The till is locked until a counter person types their own PIN (the same one
// as training). That logs them in to the till AND clocks them in; their name
// goes on every order they sell. Times only — never hours worked.

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit", hour12: true });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Kathmandu", weekday: "short", day: "numeric", month: "short" });

type Hello = { name: string; since: string; clockedInNow: boolean; missedSince: string | null };

export default function PosLockScreen() {
  const [hello, setHello] = useState<Hello | null>(null);
  // Full page load into the till — the header and the orders come from the server with their name on.
  const open = () => window.location.replace("/admin");

  const submit = useCallback(async (pin: string) => {
    const r = await posStaffLogin(pin);
    if ("error" in r) return r.error;
    setHello(r);
    if (!r.missedSince) setTimeout(open, 1500); // the forgotten-clock-out note waits for a tap
    return null;
  }, []);

  const muted = "text-stone-500 dark:text-stone-400";
  return (
    <main className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain px-4 py-6">
      <div className="my-auto w-full max-w-sm">
        <div className="mb-5 flex justify-center"><BrandLogo size="sm" tone="dark" label="POS" /></div>
        <div className="rounded-3xl bg-white p-6 text-center ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
          {hello ? (
            <div className="py-2">
              <CheckCircle2 size={40} className="mx-auto text-brand-green" />
              <p className="mt-3 font-display text-2xl font-extrabold text-brand-brown dark:text-orange-100">Hi, {hello.name}</p>
              <p className={`mt-1 text-sm ${muted}`}>{hello.clockedInNow ? `Clocked in at ${time(hello.since)}` : `On the clock since ${time(hello.since)}`}</p>
              {hello.missedSince && (
                <>
                  <p className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-left text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <span>You didn&apos;t clock out on {day(hello.missedSince)} (in at {time(hello.missedSince)}). The manager will put in that time.</span>
                  </p>
                  <button onClick={open} className="btn-primary mt-5 w-full !py-3">Open the till</button>
                </>
              )}
            </div>
          ) : (
            <>
              <p className="font-display text-xl font-bold text-brand-brown dark:text-orange-100">Who&apos;s working?</p>
              <p className={`text-sm ${muted}`}>Type your PIN to open the till and clock in.</p>
              <PinPad submit={submit} idle="Your 4-digit PIN — same as training" />
            </>
          )}
        </div>
        {!hello && (
          <button onClick={signOutHere} className={`mx-auto mt-5 block py-2 text-xs font-bold ${muted} hover:text-brand-red`}>
            Sign this device out of the POS
          </button>
        )}
      </div>
    </main>
  );
}
