"use client";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Pencil, Trash2 } from "lucide-react";
import { adminClockOut, deleteShift } from "@/app/actions/time-clock";
import type { ShiftRow as Shift } from "@/lib/time-clock";
import ShiftForm from "./shift-form";
import { cn } from "@/lib/utils";

/** "Clock out now" — someone left without tapping out, and has only just gone. */
export function ClockOutNow({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} onClick={() => {
      if (!confirm(`Clock ${name} out now?`)) return;
      start(async () => { const r = await adminClockOut(id); r?.error ? toast.error(r.error) : toast.success(`${name} clocked out`); });
    }} className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-brand-red ring-1 ring-red-200 hover:bg-red-50">
      Clock out now
    </button>
  );
}

/** One shift: phone = a card, md+ = a table row. Edit fixes a forgotten clock-out or a wrong time. */
export default function ShiftRow({ s, asTableRow }: { s: Shift; asTableRow?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const remove = () => {
    if (!confirm(`Delete ${s.name}'s shift on ${s.dateLabel} (${s.inLabel}${s.outLabel ? ` – ${s.outLabel}` : ""})?`)) return;
    start(async () => { const r = await deleteShift(s.id); r?.error ? toast.error(r.error) : toast.success("Shift deleted"); });
  };

  const out = s.state === "missed"
    ? <span className="font-bold text-amber-700">Didn&apos;t clock out</span>
    : s.state === "on" ? <span className="font-bold text-green-700">On the clock</span>
    : s.outLabel;
  const hours = s.state === "done" ? s.hours : s.state === "missed" ? <span className="text-amber-700">—</span> : <span className="text-stone-400">—</span>;
  const tags = (
    <>
      {s.edited && (
        <span className={cn("whitespace-nowrap rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-stone-500", asTableRow ? "ml-1.5" : "mt-1 inline-block")}>changed in admin</span>
      )}
      {s.note && <span className="block text-xs text-stone-500">{s.note}</span>}
    </>
  );
  const actions = (
    <span className="flex justify-end gap-1">
      {s.state === "on" && <ClockOutNow id={s.id} name={s.name} />}
      <button onClick={() => setEditing((v) => !v)} aria-label="Edit times" className="p-1.5 text-stone-400 hover:text-brand-orange"><Pencil size={15} /></button>
      <button onClick={remove} disabled={pending} aria-label="Delete shift" className="p-1.5 text-stone-400 hover:text-brand-red"><Trash2 size={15} /></button>
    </span>
  );
  const form = editing && (
    <ShiftForm id={s.id} values={{ date: s.date, inHm: s.inHm, outHm: s.outHm, note: s.note }} canStayOpen={s.state === "on"} onDone={() => setEditing(false)} />
  );

  if (asTableRow) {
    return (
      <>
        <tr className={cn("border-t border-orange-50", s.state === "missed" && "bg-amber-50/60")}>
          <td className="whitespace-nowrap px-4 py-2.5 text-stone-500">{s.dateLabel}</td>
          <td className="px-4 py-2.5"><span className="font-bold">{s.name}</span>{tags}</td>
          <td className="whitespace-nowrap px-4 py-2.5">{s.inLabel}</td>
          <td className="whitespace-nowrap px-4 py-2.5">{out}</td>
          <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums">{hours}</td>
          <td className="px-2 py-2.5">{actions}</td>
        </tr>
        {form && <tr><td colSpan={6} className="px-4 pb-3">{form}</td></tr>}
      </>
    );
  }
  return (
    <div className={cn("card p-3.5", s.state === "missed" && "ring-1 ring-amber-300")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p><span className="font-bold">{s.name}</span><span className="text-sm text-stone-500"> · {s.dateLabel}</span></p>
          <p className="text-sm">{s.inLabel} – {out}</p>
          {s.state === "done" && <p className="text-sm font-bold tabular-nums">{s.hours}</p>}
          {tags}
        </div>
        {actions}
      </div>
      {form && <div className="mt-2">{form}</div>}
    </div>
  );
}
