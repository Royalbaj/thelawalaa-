"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Delete, LogOut } from "lucide-react";
import { unlockWithPin, lockAccounts } from "@/app/actions/pin";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const LENGTH = 4;

/** Big phone-style keypad; works with a keyboard too. Unlocks as soon as 4 digits are in. */
export default function PinPad({ next }: { next: string }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [pending, start] = useTransition();

  const submit = useCallback((value: string) => {
    start(async () => {
      const r = await unlockWithPin(value);
      if (r?.ok) { window.location.replace(next); return; }
      setError(r?.error ?? "Couldn't unlock");
      setShake(true);
      setTimeout(() => { setShake(false); pinRef.current = ""; setPin(""); }, 450);
    });
  }, [next]);

  // The digits so far, read synchronously — quick taps can land before a re-render.
  const pinRef = useRef("");
  const set = (v: string) => { pinRef.current = v; setPin(v); };

  const press = useCallback((key: string) => {
    if (pending) return;
    setError(null);
    const cur = pinRef.current;
    if (key === "back") { set(cur.slice(0, -1)); return; }
    if (cur.length >= LENGTH) return;
    const value = cur + key;
    set(value);
    if (value.length === LENGTH) submit(value);
  }, [pending, submit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  async function signOut() {
    await lockAccounts();
    await createClient().auth.signOut({ scope: "local" });
    window.location.replace("/login");
  }

  return (
    <div>
      <div className={cn("my-6 flex justify-center gap-4", shake && "animate-[pin-shake_0.4s]")} aria-live="polite" aria-label={`${pin.length} of ${LENGTH} digits entered`}>
        {Array.from({ length: LENGTH }, (_, i) => (
          <span key={i} className={cn("h-4 w-4 rounded-full border-2 transition",
            i < pin.length ? "border-brand-orange bg-brand-orange" : "border-stone-300")} />
        ))}
      </div>
      <p className={cn("mb-4 min-h-5 text-sm font-bold", error ? "text-brand-red" : "text-stone-400")}>
        {error ?? (pending ? "Checking…" : "Enter the 4-digit PIN")}
      </p>
      <div className="mx-auto grid max-w-[16rem] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => press(d)} disabled={pending}
            className="h-16 touch-manipulation rounded-2xl bg-stone-100 font-display text-2xl font-bold text-brand-brown transition active:scale-95 active:bg-orange-100 disabled:opacity-50">
            {d}
          </button>
        ))}
        <button onClick={signOut} aria-label="Sign out"
          className="flex h-16 touch-manipulation items-center justify-center rounded-2xl text-stone-400 transition hover:text-brand-red">
          <LogOut size={20} />
        </button>
        <button onClick={() => press("0")} disabled={pending}
          className="h-16 touch-manipulation rounded-2xl bg-stone-100 font-display text-2xl font-bold text-brand-brown transition active:scale-95 active:bg-orange-100 disabled:opacity-50">
          0
        </button>
        <button onClick={() => press("back")} aria-label="Delete last digit" disabled={pending}
          className="flex h-16 touch-manipulation items-center justify-center rounded-2xl text-stone-500 transition active:scale-95">
          <Delete size={22} />
        </button>
      </div>
      <style>{`@keyframes pin-shake { 0%,100% { transform: translateX(0) } 20%,60% { transform: translateX(-8px) } 40%,80% { transform: translateX(8px) } }`}</style>
    </div>
  );
}
