"use client";
import { useTransition } from "react";
import { UserRound } from "lucide-react";
import { lockTraining } from "@/app/actions/training";

/** "Watching as Sita · Not you?" — back to the PIN pad for the next person on this device. */
export default function SwitchTrainee({ name }: { name: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-orange-50 px-4 py-3 ring-1 ring-orange-100 dark:bg-orange-950/30 dark:ring-orange-900/40">
      <p className="flex min-w-0 items-center gap-2 text-sm text-brand-brown dark:text-orange-100">
        <UserRound size={18} className="shrink-0 text-brand-orange" />
        <span className="truncate">Training as <b>{name}</b></span>
      </p>
      <button disabled={pending} onClick={() => start(async () => { await lockTraining(); window.location.replace("/staff"); })}
        className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand-orange ring-1 ring-orange-200 dark:bg-stone-900 dark:ring-orange-900/50">
        {pending ? "…" : "Not you? Switch"}
      </button>
    </div>
  );
}
