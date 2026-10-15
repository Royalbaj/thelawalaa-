"use client";
import { useCallback } from "react";
import { unlockTraining } from "@/app/actions/training";
import PinPad from "@/components/pin-pad";

/** Staff Portal: type your own 4-digit training PIN. */
export default function TrainingPinPad() {
  const submit = useCallback(async (pin: string) => {
    const r = await unlockTraining(pin);
    if ("ok" in r && r.ok) { window.location.replace("/staff"); return null; }
    return ("error" in r && r.error) || "Couldn't open training";
  }, []);

  return (
    <section aria-labelledby="who" className="card mx-auto max-w-sm p-6 text-center sm:p-8">
      <span aria-hidden className="mx-auto block h-0.5 w-10 rounded-full bg-brand-orange" />
      <h2 id="who" className="mt-4 font-display text-xl font-bold text-brand-brown dark:text-orange-50">Who&apos;s training?</h2>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Type your own 4-digit training PIN — the manager gave it to you.</p>
      <PinPad submit={submit} />
    </section>
  );
}
