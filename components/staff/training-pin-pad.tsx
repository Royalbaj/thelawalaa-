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
    <div className="card mx-auto max-w-sm p-6 text-center">
      <p className="font-display text-lg font-bold text-brand-brown dark:text-orange-100">Who&apos;s training?</p>
      <p className="text-sm text-stone-500">Type your own training PIN — the manager gave it to you.</p>
      <PinPad submit={submit} />
    </div>
  );
}
