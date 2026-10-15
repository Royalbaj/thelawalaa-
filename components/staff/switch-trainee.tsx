"use client";
import { useTransition } from "react";
import { lockTraining } from "@/app/actions/training";

/** "Sita · Not you?" — back to the PIN pad for the next person on this device. */
export default function SwitchTrainee({ name }: { name: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2 rounded-full bg-stone-100 py-1 pl-3 pr-1 text-sm dark:bg-stone-800">
      <span className="max-w-[10rem] truncate font-bold text-brand-brown dark:text-orange-50">{name}</span>
      <button type="button" disabled={pending}
        onClick={() => start(async () => { await lockTraining(); window.location.replace("/staff"); })}
        className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand-orange shadow-sm transition hover:bg-orange-50 disabled:opacity-60 dark:bg-stone-900 dark:hover:bg-stone-950">
        {pending ? "Switching…" : "Not you?"}
      </button>
    </div>
  );
}
