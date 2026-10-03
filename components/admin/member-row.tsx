"use client";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Pencil, Trash2, X } from "lucide-react";
import { updateMembership, deleteMembership } from "@/app/actions/memberships";

export type MemberRowData = { id: string; full_name: string; phone: string; card_number: string | null; sold: string; soldBy: string; order: string | null };

/** One membership: phone = a card, md+ = a table row. Edit fixes typos taken at the counter. */
export default function MemberRow({ m, asTableRow }: { m: MemberRowData; asTableRow?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const remove = () => {
    if (!confirm(`Remove ${m.full_name}'s membership record?`)) return;
    start(async () => { const r = await deleteMembership(m.id); r?.error ? toast.error(r.error) : toast.success("Removed"); });
  };
  const actions = (
    <span className="flex justify-end gap-1">
      <button onClick={() => setEditing((v) => !v)} aria-label="Edit" className="p-1.5 text-stone-400 hover:text-brand-orange"><Pencil size={15} /></button>
      <button onClick={remove} disabled={pending} aria-label="Remove" className="p-1.5 text-stone-400 hover:text-brand-red"><Trash2 size={15} /></button>
    </span>
  );
  const form = editing && (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.currentTarget));
      start(async () => {
        const r = await updateMembership(m.id, fd);
        if (r?.error) toast.error(r.error); else { toast.success("Saved"); setEditing(false); }
      });
    }}>
      <input name="full_name" defaultValue={m.full_name} required maxLength={100} className="input !w-44 !py-1.5 text-base sm:text-sm" aria-label="Full name" />
      <input name="phone" defaultValue={m.phone} required inputMode="tel" className="input !w-36 !py-1.5 text-base sm:text-sm" aria-label="Mobile number" />
      <input name="card_number" defaultValue={m.card_number ?? ""} maxLength={30} placeholder="Card no." className="input !w-28 !py-1.5 text-base sm:text-sm" aria-label="Card number" />
      <button disabled={pending} className="btn-primary !px-4 !py-1.5 text-sm">Save</button>
      <button type="button" onClick={() => setEditing(false)} className="p-1.5 text-stone-400" aria-label="Cancel"><X size={16} /></button>
    </form>
  );

  if (asTableRow) {
    return (
      <>
        <tr className="border-t border-orange-50">
          <td className="px-4 py-2.5 font-bold">{m.full_name}</td>
          <td className="px-4 py-2.5"><a href={`tel:${m.phone}`} className="hover:text-brand-orange">{m.phone}</a></td>
          <td className="px-4 py-2.5 text-stone-500">{m.card_number ?? "—"}</td>
          <td className="px-4 py-2.5 text-stone-500">{m.sold}</td>
          <td className="px-4 py-2.5 text-stone-500">{m.soldBy}{m.order ? ` · ${m.order}` : ""}</td>
          <td className="px-2 py-2.5">{actions}</td>
        </tr>
        {form && <tr><td colSpan={6} className="px-4 pb-3">{form}</td></tr>}
      </>
    );
  }
  return (
    <div className="card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold">{m.full_name}</p>
          <p className="text-sm"><a href={`tel:${m.phone}`} className="text-brand-orange">{m.phone}</a>{m.card_number ? <span className="text-stone-500"> · card {m.card_number}</span> : null}</p>
          <p className="text-xs text-stone-400">{m.sold} · {m.soldBy}{m.order ? ` · ${m.order}` : ""}</p>
        </div>
        {actions}
      </div>
      {form && <div className="mt-2">{form}</div>}
    </div>
  );
}
