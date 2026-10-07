"use client";
import { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { orderSoundReady, resumeOrderSound, unlockOrderSound } from "@/lib/order-sound";

/**
 * Keeps the POS order sound on (owner's call: always on). Browsers — iPad
 * Safari especially — only allow sound after a tap, and lose it on a reload
 * or after the app was in the background. So every tap anywhere on the POS
 * (the PIN screen included) turns it back on, and while it's off a big bar
 * says so. An order that arrives while it's off still rings on the next tap.
 */
export default function OrderSoundKeeper() {
  const [on, setOn] = useState(true); // optimistic: no bar flash before the first check

  useEffect(() => {
    const check = () => setOn(orderSoundReady());
    const tap = () => { unlockOrderSound().then(setOn); };
    const back = () => { if (document.visibilityState === "visible") resumeOrderSound().then(setOn); };
    check();
    window.addEventListener("pointerdown", tap, { capture: true });
    window.addEventListener("keydown", tap, { capture: true });
    document.addEventListener("visibilitychange", back);
    const poll = setInterval(check, 3000); // iOS can suspend it quietly
    return () => {
      window.removeEventListener("pointerdown", tap, { capture: true });
      window.removeEventListener("keydown", tap, { capture: true });
      document.removeEventListener("visibilitychange", back);
      clearInterval(poll);
    };
  }, []);

  if (on) return null;
  return (
    <button onClick={() => unlockOrderSound().then(setOn)}
      className="flex w-full shrink-0 items-center justify-center gap-2 bg-amber-400 px-4 py-2.5 text-sm font-extrabold text-stone-900 active:bg-amber-300">
      <Volume2 size={17} /> Tap here to turn on the order sound
    </button>
  );
}
