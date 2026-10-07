"use client";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Plus, X } from "lucide-react";
import { saveShift } from "@/app/actions/time-clock";

export type ShiftFormValues = { date: string; inHm: string; outHm: string; note: string | null };

/**
 * Add a shift someone forgot to clock, or fix one's times. Banepa time; a
 * clock-out earlier than the clock-in is the next morning. `canStayOpen`:
 * the shift running now, where an empty clock-out keeps them on the clock.
 */
export default function ShiftForm({ id, values, people, canStayOpen, onDone }: {
  id: string | null;
  values: ShiftFormValues;
  people?: { id: string; name: string }[];     // adding: pick who worked
  canStayOpen?: boolean;
  onDone: () => void;
}) {
  const [personId, setPersonId] = useState(people?.[0]?.id ?? "");
  const [date, setDate] = useState(values.date);
  const [inHm, setIn] = useState(values.inHm);
  const [outHm, setOut] = useState(values.outHm);
  const [note, setNote] = useState(values.note ?? "");
  const [pending, start] = useTransition();
  const field = "input mt-1 !py-2 text-base sm:text-sm";

  return (
    <form className="space-y-2 rounded-2xl bg-stone-50 p-3" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await saveShift(id, { person_id: id ? undefined : personId, date, in: inHm, out: outHm, note: note.trim() || undefined });
        if (r?.error) { toast.error(r.error); return; }
        toast.success(id ? "Shift saved" : "Shift added");
        onDone();
      });
    }}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {people && (
          <label className="col-span-2 text-xs font-bold text-stone-500 sm:col-span-1">Who
            <select value={personId} onChange={(e) => setPersonId(e.target.value)} required className={field}>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <label className="col-span-2 text-xs font-bold text-stone-500 sm:col-span-1">Day it started
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={field} />
        </label>
        <label className="text-xs font-bold text-stone-500">Clock in
          <input type="time" value={inHm} onChange={(e) => setIn(e.target.value)} required className={field} />
        </label>
        <label className="text-xs font-bold text-stone-500">Clock out
          <input type="time" value={outHm} onChange={(e) => setOut(e.target.value)} required={!canStayOpen} className={field} />
        </label>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Note (optional), e.g. left at 6"
        aria-label="Note" className="input !py-2 text-base sm:text-sm" />
      {canStayOpen && <p className="text-xs text-stone-500">Leave the clock-out empty if they&apos;re still at work.</p>}
      <div className="flex items-center gap-2">
        <button disabled={pending || (people && !personId)} className="btn-primary !px-5 !py-2 text-sm">
          {id ? "Save" : <><Plus size={15} /> Add shift</>}
        </button>
        <button type="button" onClick={onDone} className="p-2 text-stone-400" aria-label="Cancel"><X size={16} /></button>
      </div>
    </form>
  );
}
