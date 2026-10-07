"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { nepalToday } from "@/lib/dates";
import ShiftForm from "./shift-form";

/** "Add a missed shift" — someone worked but never clocked in. */
export default function AddShift({ people }: { people: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  if (!people.length) return null;
  return open ? (
    <ShiftForm id={null} people={people} values={{ date: nepalToday(), inHm: "", outHm: "", note: null }} onDone={() => setOpen(false)} />
  ) : (
    <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold text-stone-600 ring-1 ring-stone-200 hover:bg-orange-50">
      <Plus size={15} /> Add a missed shift
    </button>
  );
}
