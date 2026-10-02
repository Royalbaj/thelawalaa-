"use client";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { Check, CheckCheck } from "lucide-react";
import { markFeedbackRead } from "@/app/actions/feedback";

export function MarkReadButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(async () => { const r = await markFeedbackRead(id); if (r?.error) toast.error(r.error); })}
      className="flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50 disabled:opacity-50">
      <Check size={13} /> Mark read
    </button>
  );
}

export function MarkAllReadButton() {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => start(async () => {
      const r = await markFeedbackRead("all");
      if (r?.error) toast.error(r.error); else toast.success("All marked as read");
    })} className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-bold text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50 disabled:opacity-50">
      <CheckCheck size={15} /> Mark all read
    </button>
  );
}
