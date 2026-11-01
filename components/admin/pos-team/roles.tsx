"use client";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";
import { createRole, updateRole, deleteRole } from "@/app/actions/pos-team";
import { POS_FEATURES, type PosFeature } from "@/lib/pos-features";
import { cn } from "@/lib/utils";

type Role = { id: string; name: string; features: PosFeature[]; people: number };

/** Tick boxes for what a role can do — selling is always allowed, so it isn't here. */
function FeatureBoxes({ value, onChange }: { value: PosFeature[]; onChange: (v: PosFeature[]) => void }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {POS_FEATURES.map((f) => (
        <label key={f.key} className={cn("flex cursor-pointer items-start gap-2.5 rounded-xl p-2.5 ring-1 transition",
          value.includes(f.key) ? "bg-orange-50 ring-orange-200" : "bg-white ring-stone-200 hover:bg-stone-50")}>
          <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-brand-orange" checked={value.includes(f.key)}
            onChange={(e) => onChange(e.target.checked ? [...value, f.key] : value.filter((k) => k !== f.key))} />
          <span>
            <span className="block text-sm font-bold">{f.label}</span>
            <span className="block text-xs text-stone-500">{f.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function RoleCard({ r }: { r: Role }) {
  const [name, setName] = useState(r.name);
  const [features, setFeatures] = useState<PosFeature[]>(r.features);
  const [pending, start] = useTransition();
  const dirty = name.trim() !== r.name || features.length !== r.features.length || features.some((f) => !r.features.includes(f));
  const save = () => start(async () => {
    const res = await updateRole(r.id, { name: name.trim(), features });
    res?.error ? toast.error(res.error) : toast.success(`${name.trim()} saved — the POS follows it on its next refresh`);
  });
  const remove = () => {
    if (!confirm(`Delete the role "${r.name}"?${r.people ? ` ${r.people} ${r.people === 1 ? "person has" : "people have"} it — they'll keep only the basic abilities until you give them another role.` : ""}`)) return;
    start(async () => { const res = await deleteRole(r.id); res?.error ? toast.error(res.error) : toast.success("Role deleted"); });
  };
  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Role name" className="input !w-auto min-w-0 flex-1 !py-2 text-base font-bold sm:text-sm" />
        <span className="text-xs text-stone-500">{r.people} {r.people === 1 ? "person" : "people"}</span>
        <button onClick={remove} disabled={pending} aria-label={`Delete ${r.name}`} className="p-2 text-stone-400 hover:text-brand-red"><Trash2 size={16} /></button>
      </div>
      <FeatureBoxes value={features} onChange={setFeatures} />
      {dirty && (
        <div className="flex gap-2">
          <button onClick={save} disabled={pending || !name.trim()} className="btn-primary !px-5 !py-2 text-sm">{pending ? "Saving…" : "Save role"}</button>
          <button onClick={() => { setName(r.name); setFeatures(r.features); }} className="px-3 text-sm font-bold text-stone-500">Undo</button>
        </div>
      )}
    </div>
  );
}

/** Admin → POS team & roles: each role and the extra things it allows. */
export default function PosRoles({ roles }: { roles: Role[] }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [features, setFeatures] = useState<PosFeature[]>(["close_shift"]);
  const [pending, start] = useTransition();
  const add = () => start(async () => {
    const r = await createRole({ name: name.trim(), features });
    if (r?.error) { toast.error(r.error); return; }
    toast.success(`${name.trim()} added`); setAdding(false); setName(""); setFeatures(["close_shift"]);
  });
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-brand-brown">Roles</h2>
          <p className="text-xs text-stone-500">Everyone can sell. A role adds the rest — change a role once and everyone with it changes.</p>
        </div>
        {!adding && <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-bold text-stone-600 ring-1 ring-stone-200 hover:bg-orange-50"><Plus size={15} /> Add a role</button>}
      </div>
      {adding && (
        <div className="card space-y-3 p-4 ring-2 ring-orange-200">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Role name, e.g. Kitchen lead" aria-label="New role name" autoFocus className="input text-base sm:text-sm" />
          <FeatureBoxes value={features} onChange={setFeatures} />
          <div className="flex gap-2">
            <button onClick={add} disabled={pending || !name.trim()} className="btn-primary !px-5 !py-2 text-sm">{pending ? "Adding…" : "Add role"}</button>
            <button onClick={() => setAdding(false)} className="px-3 text-sm font-bold text-stone-500">Cancel</button>
          </div>
        </div>
      )}
      <div className="grid gap-3 lg:grid-cols-2">{roles.map((r) => <RoleCard key={r.id} r={r} />)}</div>
    </section>
  );
}
