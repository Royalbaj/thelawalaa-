"use client";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { KeyRound, Pencil, UserPlus, Power, X, Check } from "lucide-react";
import { addAccountPerson, updateAccountPerson } from "@/app/actions/accounts-people";
import { ACCOUNTS_URL } from "@/lib/role-home";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string; is_active: boolean; created_at: string };

const pinInput = "input !w-24 text-center text-base tracking-[0.4em] sm:text-sm";
const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

function PersonRow({ p }: { p: Person }) {
  const [mode, setMode] = useState<"rename" | "pin" | "on" | null>(null);
  const [name, setName] = useState(p.name);
  const [pin, setPin] = useState("");
  const [pending, start] = useTransition();
  const run = (patch: Record<string, unknown>, done: string) => start(async () => {
    const r = await updateAccountPerson(p.id, patch);
    if (r?.error) { toast.error(r.error); return; }
    toast.success(done); setMode(null); setPin("");
  });

  return (
    <li className={cn("py-2.5", !p.is_active && "opacity-60")}>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-bold">{p.name}{!p.is_active && <span className="ml-1.5 text-xs font-normal text-stone-500">(switched off)</span>}</span>
        {p.is_active ? (
          <>
            <button onClick={() => setMode(mode === "rename" ? null : "rename")} title="Rename" className="p-1.5 text-stone-400 hover:text-brand-orange"><Pencil size={15} /></button>
            <button onClick={() => setMode(mode === "pin" ? null : "pin")} title="Give a new PIN (forgotten PIN)" className="p-1.5 text-stone-400 hover:text-brand-orange"><KeyRound size={15} /></button>
            <button disabled={pending} onClick={() => { if (confirm(`Switch ${p.name} off? Their PIN stops working; their entries stay.`)) run({ is_active: false }, "Switched off"); }}
              title="Switch off" className="p-1.5 text-stone-400 hover:text-brand-red"><Power size={15} /></button>
          </>
        ) : (
          <button onClick={() => setMode(mode === "on" ? null : "on")} className="rounded-full px-3 py-1 text-xs font-bold text-green-700 ring-1 ring-green-200">Switch on</button>
        )}
      </div>
      {mode === "rename" && (
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); run({ name }, "Renamed"); }}>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus className="input !py-1.5 text-base sm:text-sm" />
          <button disabled={pending} className="p-2 text-green-700" aria-label="Save"><Check size={16} /></button>
          <button type="button" onClick={() => setMode(null)} className="p-2 text-stone-400" aria-label="Cancel"><X size={16} /></button>
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

/** Admin → Staff & Users: the people who use the Accounts app, each with their own PIN. */
export default function AccountsPeople({ people }: { people: Person[] }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="card space-y-3 p-5">
      <div>
        <h3 className="font-display font-bold text-brand-brown">Accounts people</h3>
        <p className="text-xs text-stone-500">
          Who uses <a href={ACCOUNTS_URL} target="_blank" rel="noopener noreferrer" className="font-bold text-brand-orange">accounts.thelawalaa.com</a>.
          After the Accounts sign-in, each person types their own 4-digit PIN — that&apos;s how every entry shows who made it.
        </p>
      </div>
      <ul className="divide-y divide-orange-50">
        {people.map((p) => <PersonRow key={p.id} p={p} />)}
        {people.length === 0 && <li className="py-3 text-sm text-stone-500">Nobody yet — add the first person below.</li>}
      </ul>
      <form className="space-y-2 border-t border-orange-50 pt-3" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addAccountPerson({ name, pin });
          if (r?.error) { toast.error(r.error); return; }
          toast.success(`${name} added — tell them their PIN`); setName(""); setPin("");
        });
      }}>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Sita)" maxLength={40} required className="input text-base sm:text-sm" />
          <input value={pin} onChange={(e) => setPin(onlyDigits(e.target.value))} placeholder="PIN" inputMode="numeric" pattern="\d{4}" required
            aria-label="4-digit PIN" className={pinInput} />
        </div>
        <button disabled={pending || pin.length !== 4 || !name.trim()} className="btn-primary w-full !py-2.5 text-sm"><UserPlus size={15} /> Add person</button>
      </form>
    </section>
  );
}
