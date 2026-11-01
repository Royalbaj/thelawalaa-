"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { KeyRound, UserPlus, X } from "lucide-react";
import { addTrainingPerson, updateTrainingPerson } from "@/app/actions/training";
import { setPersonRole } from "@/app/actions/pos-team";

type Person = { id: string; name: string; pos_clock: boolean; role_id: string | null };
type Role = { id: string; name: string };

const pinInput = "input !w-24 text-center text-base tracking-[0.4em] sm:text-sm";
const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

function PersonRow({ p, roles }: { p: Person; roles: Role[] }) {
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pending, start] = useTransition();
  const toggle = () => {
    if (p.pos_clock && !confirm(`Stop ${p.name} using the POS? Their PIN stops working there, and if they're clocked in now, they're clocked out.`)) return;
    start(async () => {
      const r = await updateTrainingPerson(p.id, { pos_clock: !p.pos_clock });
      r?.error ? toast.error(r.error) : toast.success(p.pos_clock ? `${p.name} can't use the POS any more` : `${p.name} can use the POS now`);
    });
  };
  const changeRole = (roleId: string) => start(async () => {
    const r = await setPersonRole(p.id, roleId || null);
    r?.error ? toast.error(r.error) : toast.success(`${p.name} is ${roles.find((x) => x.id === roleId)?.name ?? "basic counter staff"} now`);
  });

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-bold">{p.name}</p>
        <select value={p.role_id ?? ""} onChange={(e) => changeRole(e.target.value)} disabled={pending} aria-label={`${p.name}'s role`}
          className="input !w-auto !py-1.5 text-base font-bold sm:text-sm">
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          <option value="">No role (basic)</option>
        </select>
        <button disabled={pending} onClick={toggle} aria-pressed={p.pos_clock}
          className={p.pos_clock ? "badge bg-green-100 text-green-800" : "badge bg-stone-200 text-stone-600"}>
          {p.pos_clock ? "Can use the POS" : "Not on the POS"}
        </button>
        <button onClick={() => setPinOpen((v) => !v)} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-stone-500 ring-1 ring-stone-200 hover:text-brand-orange">
          <KeyRound size={12} /> New PIN
        </button>
      </div>
      {pinOpen && (
        <form className="mt-2 flex items-center gap-2" onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await updateTrainingPerson(p.id, { pin });
            if (r?.error) { toast.error(r.error); return; }
            toast.success(`New PIN saved — tell ${p.name}`); setPinOpen(false); setPin("");
          });
        }}>
          <span className="text-xs text-stone-500">New PIN</span>
          <input value={pin} onChange={(e) => setPin(onlyDigits(e.target.value))} inputMode="numeric" pattern="\d{4}" required autoFocus aria-label="New 4-digit PIN" className={pinInput} />
          <button disabled={pending || pin.length !== 4} className="btn-primary !px-4 !py-1.5 text-sm">Save</button>
          <button type="button" onClick={() => { setPinOpen(false); setPin(""); }} className="p-2 text-stone-400" aria-label="Cancel"><X size={16} /></button>
        </form>
      )}
    </li>
  );
}

/** Admin → POS team & roles: who may use the POS, their role and their PINs (the same team + PINs as Staff Training). */
export default function PosPeople({ people, roles, videoIds }: { people: Person[]; roles: Role[]; videoIds: string[] }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [pending, start] = useTransition();
  return (
    <section className="card space-y-3 p-5">
      <div>
        <h3 className="font-display font-bold text-brand-brown">People · role · PIN</h3>
        <p className="text-xs text-stone-500">
          Each person has their own 4-digit PIN (the same one as Staff Training) for logging in to the till and for clocking in and out, and a
          role that decides what else they can do on the POS. PINs can&apos;t be shown again, so give a new one if someone forgets theirs.
        </p>
      </div>
      <ul className="divide-y divide-orange-50">
        {people.map((p) => <PersonRow key={p.id} p={p} roles={roles} />)}
        {people.length === 0 && <li className="py-3 text-sm text-stone-500">Nobody yet. Add your counter staff below.</li>}
        {people.length > 0 && !people.some((p) => p.pos_clock) && (
          <li className="py-3 text-xs text-amber-800">As soon as one person here can use the POS, it asks for a PIN before anyone can sell.</li>
        )}
      </ul>
      <form className="space-y-2 border-t border-orange-50 pt-3" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          // New people get the training videos that are on now, same as adding them in Staff Training.
          const r = await addTrainingPerson({ name, pin, video_ids: videoIds, pos_clock: true, role_id: roleId || null });
          if (r?.error) { toast.error(r.error); return; }
          toast.success(`${name} added. Tell them their PIN.`); setName(""); setPin("");
        });
      }}>
        <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Add a person</p>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Sita)" maxLength={40} required className="input text-base sm:text-sm" />
          <input value={pin} onChange={(e) => setPin(onlyDigits(e.target.value))} placeholder="PIN" inputMode="numeric" pattern="\d{4}" required
            aria-label="4-digit PIN" className={pinInput} />
        </div>
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)} aria-label="Role" className="input text-base sm:text-sm">
          {roles.map((r) => <option key={r.id} value={r.id}>Role: {r.name}</option>)}
          <option value="">No role (basic)</option>
        </select>
        <button disabled={pending || pin.length !== 4 || !name.trim()} className="btn-primary w-full !py-2.5 text-sm"><UserPlus size={15} /> Add person</button>
      </form>
      <p className="text-xs text-stone-400">
        Switching someone off, removing them, and their training videos are in <Link href="/admin/training" className="font-bold text-brand-orange">Staff Training</Link>.
      </p>
    </section>
  );
}
