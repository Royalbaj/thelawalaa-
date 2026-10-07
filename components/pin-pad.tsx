"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

const LENGTH = 4;

/**
 * A staff member's own 4-digit PIN (Staff Training, the POS time clock): big
 * keys for a touch screen, a keyboard works too. `submit` gets the PIN once
 * all four digits are in and returns an error to show, or null when it worked.
 */
export default function PinPad({ submit, idle = "Enter the 4-digit PIN" }: {
  submit: (pin: string) => Promise<string | null>;
  idle?: string;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [pending, start] = useTransition();
  // The digits so far, read synchronously — quick taps can land before a re-render.
  const pinRef = useRef("");
  const set = (v: string) => { pinRef.current = v; setPin(v); };

  const check = useCallback((value: string) => {
    start(async () => {
      const err = await submit(value).catch(() => "No connection — try again");
      if (!err) return;
      setError(err);
      setShake(true);
      setTimeout(() => { setShake(false); set(""); }, 450);
    });
  }, [submit]);

  const press = useCallback((key: string) => {
    if (pending) return;
    setError(null);
    const cur = pinRef.current;
    if (key === "back") { set(cur.slice(0, -1)); return; }
    if (cur.length >= LENGTH) return;
    const value = cur + key;
    set(value);
    if (value.length === LENGTH) check(value);
  }, [pending, check]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press]);

  const key = "h-16 touch-manipulation rounded-2xl bg-stone-100 font-display text-2xl font-bold text-brand-brown transition active:scale-95 active:bg-orange-100 disabled:opacity-50 dark:bg-stone-800 dark:text-orange-100 dark:active:bg-orange-950";
  return (
    <>
      <div className={cn("my-5 flex justify-center gap-4", shake && "animate-[pin-shake_0.4s]")} aria-live="polite" aria-label={`${pin.length} of ${LENGTH} digits entered`}>
        {Array.from({ length: LENGTH }, (_, i) => (
          <span key={i} className={cn("h-4 w-4 rounded-full border-2 transition", i < pin.length ? "border-brand-orange bg-brand-orange" : "border-stone-300 dark:border-stone-600")} />
        ))}
      </div>
      <p className={cn("mb-4 min-h-5 text-sm font-bold", error ? "text-brand-red" : "text-stone-400")}>
        {error ?? (pending ? "Checking…" : idle)}
      </p>
      <div className="mx-auto grid max-w-[16rem] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => press(d)} disabled={pending} className={key}>{d}</button>
        ))}
        <span />
        <button onClick={() => press("0")} disabled={pending} className={key}>0</button>
        <button onClick={() => press("back")} aria-label="Delete last digit" disabled={pending}
          className="flex h-16 touch-manipulation items-center justify-center rounded-2xl text-stone-500 transition active:scale-95">
          <Delete size={22} />
        </button>
      </div>
      <style>{`@keyframes pin-shake { 0%,100% { transform: translateX(0) } 20%,60% { transform: translateX(-8px) } 40%,80% { transform: translateX(8px) } }`}</style>
    </>
  );
}
