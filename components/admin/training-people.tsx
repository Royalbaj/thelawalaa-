"use client";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, Clock, KeyRound, Pencil, Power, Trash2, UserPlus, X } from "lucide-react";
import { addTrainingPerson, updateTrainingPerson, deleteTrainingPerson } from "@/app/actions/training";
import type { TraineeStatus, TrainingVideoStatus } from "@/lib/training-status";
import { cn } from "@/lib/utils";

type Video = Pick<TrainingVideoStatus, "id" | "title" | "is_active">;

const pinInput = "input !w-24 text-center text-base tracking-[0.4em] sm:text-sm";
const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

/** Tick which videos this person has to watch. */
function VideoPicker({ videos, value, onChange }: { videos: Video[]; value: string[]; onChange: (ids: string[]) => void }) {
  if (!videos.length) return <p className="text-xs text-stone-400">Add a training video below first.</p>;
  const all = videos.every((v) => value.includes(v.id));
  return (
    <div className="rounded-xl bg-stone-50 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-bold text-stone-500">Videos to watch</span>
        <button type="button" onClick={() => onChange(all ? [] : videos.map((v) => v.id))} className="text-xs font-bold text-brand-orange">
          {all ? "Clear all" : "Tick all"}
        </button>
      </div>
      <div className="space-y-1">
        {videos.map((v) => (
          <label key={v.id} className="flex items-center gap-2 py-1 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-brand-orange" checked={value.includes(v.id)}
              onChange={(e) => onChange(e.target.checked ? [...value, v.id] : value.filter((id) => id !== v.id))} />
            <span className={cn(!v.is_active && "text-stone-400")}>{v.title}{!v.is_active && " (switched off)"}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function PersonRow({ p, videos }: { p: TraineeStatus; videos: Video[] }) {
  const [mode, setMode] = useState<"edit" | "pin" | "on" | null>(null);
  const [name, setName] = useState(p.name);
  const [ids, setIds] = useState(p.videoIds);
  const [pin, setPin] = useState("");
  const [pending, start] = useTransition();
  const run = (patch: Record<string, unknown>, done: string) => start(async () => {
    const r = await updateTrainingPerson(p.id, patch);
    if (r?.error) { toast.error(r.error); return; }
    toast.success(done); setMode(null); setPin("");
  });

  return (
    <li className={cn("py-3", !p.is_active && "opacity-60")}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{p.name}{!p.is_active && <span className="ml-1.5 text-xs font-normal text-stone-500">(switched off)</span>}</p>
          {p.total === 0 ? (
            <p className="text-xs text-stone-400">No videos given yet</p>
          ) : p.missing.length ? (
            <p className="text-xs text-stone-500">Still to watch: {p.missing.join(", ")}</p>
          ) : (
            <p className="text-xs text-green-700">Watched: {p.watched.map((w) => `${w.title} (${w.at})`).join(", ")}</p>
          )}
        </div>
        {p.total > 0 && (p.missing.length === 0 ? (
          <span className="badge shrink-0 gap-1 bg-green-100 text-green-800"><CheckCircle2 size={12} /> All done</span>
        ) : (
          <span className="badge shrink-0 gap-1 bg-amber-100 text-amber-800"><Clock size={12} /> {p.done} of {p.total}</span>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {p.is_active ? (
          <>
            <button onClick={() => setMode(mode === "edit" ? null : "edit")} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-stone-500 ring-1 ring-stone-200 hover:text-brand-orange">
              <Pencil size={12} /> Name & videos
            </button>
            <button onClick={() => setMode(mode === "pin" ? null : "pin")} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-stone-500 ring-1 ring-stone-200 hover:text-brand-orange">
              <KeyRound size={12} /> New PIN
            </button>
            <button disabled={pending} onClick={() => { if (confirm(`Switch ${p.name} off? Their PIN stops working; what they watched stays.`)) run({ is_active: false }, "Switched off"); }}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-stone-500 ring-1 ring-stone-200 hover:text-brand-red">
              <Power size={12} /> Switch off
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setMode(mode === "on" ? null : "on")} className="rounded-full px-3 py-1 text-xs font-bold text-green-700 ring-1 ring-green-200">Switch on</button>
            <button disabled={pending} onClick={() => {
              if (!confirm(`Remove ${p.name} completely, with their training record?`)) return;
              start(async () => { const r = await deleteTrainingPerson(p.id); r?.error ? toast.error(r.error) : toast.success("Removed"); });
            }} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-stone-400 hover:text-brand-red">
              <Trash2 size={12} /> Remove
            </button>
          </>
        )}
      </div>

      {mode === "edit" && (
        <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); run({ name, video_ids: ids }, "Saved"); }}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required className="input !py-1.5 text-base sm:text-sm" aria-label="Name" />
          <VideoPicker videos={videos} value={ids} onChange={setIds} />
          <div className="flex gap-2">
            <button disabled={pending || !name.trim()} className="btn-primary !px-5 !py-1.5 text-sm">Save</button>
            <button type="button" onClick={() => { setMode(null); setName(p.name); setIds(p.videoIds); }} className="p-2 text-stone-400" aria-label="Cancel"><X size={16} /></button>
          </div>
        </form>
      )}
      {(mode === "pin" || mode === "on") && (
        <form className="mt-2 flex items-center gap-2" onSubmit={(e) => {
          e.preventDefault();
          run(mode === "on" ? { pin, is_active: true } : { pin }, mode === "on" ? "Switched on with the new PIN" : "New PIN saved — tell them");
        }}>
          <span className="text-xs text-stone-500">New PIN</span>
          <input value={pin} onChange={(e) => setPin(onlyDigits(e.target.value))} inputMode="numeric" pattern="\d{4}" required autoFocus className={pinInput} />
          <button disabled={pending || pin.length !== 4} className="btn-primary !px-4 !py-1.5 text-sm">Save</button>
          <button type="button" onClick={() => { setMode(null); setPin(""); }} className="p-2 text-stone-400" aria-label="Cancel"><X size={16} /></button>
        </form>
      )}
    </li>
  );
}

/** Admin → Staff Training: each staff member, their own PIN, and which videos they must watch. */
export default function TrainingPeople({ team, videos }: { team: TraineeStatus[]; videos: Video[] }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [ids, setIds] = useState<string[]>(() => videos.filter((v) => v.is_active).map((v) => v.id));
  const [pending, start] = useTransition();
  return (
    <section className="card space-y-3 p-5">
      <div>
        <h3 className="font-display font-bold text-brand-brown">Team & PINs</h3>
        <p className="text-xs text-stone-500">
          Give each staff member their own 4-digit PIN and pick their videos. On the POS they tap the Training (graduation cap) button, type their PIN,
          and see only their videos — so you know exactly who has watched what, even on a shared login.
        </p>
      </div>
      <ul className="divide-y divide-orange-50">
        {team.map((p) => <PersonRow key={p.id} p={p} videos={videos} />)}
        {team.length === 0 && <li className="py-3 text-sm text-stone-500">Nobody yet — add the first person below.</li>}
      </ul>
      <form className="space-y-2 border-t border-orange-50 pt-3" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addTrainingPerson({ name, pin, video_ids: ids });
          if (r?.error) { toast.error(r.error); return; }
          toast.success(`${name} added — tell them their PIN`); setName(""); setPin("");
        });
      }}>
        <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Add a person</p>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Sita)" maxLength={40} required className="input text-base sm:text-sm" />
          <input value={pin} onChange={(e) => setPin(onlyDigits(e.target.value))} placeholder="PIN" inputMode="numeric" pattern="\d{4}" required
            aria-label="4-digit PIN" className={pinInput} />
        </div>
        <VideoPicker videos={videos} value={ids} onChange={setIds} />
        <button disabled={pending || pin.length !== 4 || !name.trim()} className="btn-primary w-full !py-2.5 text-sm"><UserPlus size={15} /> Add person</button>
      </form>
    </section>
  );
}
