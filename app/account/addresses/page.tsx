"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<any[]>([]);

  const load = () =>
    createClient().from("addresses").select("*").order("created_at").then(({ data }) => setAddresses(data ?? []));
  useEffect(() => { load(); }, []);

  return (
    <div className="px-4 py-4 pb-24">
      <h1 className="font-display text-xl font-bold text-brand-brown">Saved addresses</h1>
      {addresses.length === 0 && (
        <p className="mt-6 rounded-2xl bg-white border border-stone-100 p-6 text-center text-sm text-stone-400">No saved addresses yet.</p>
      )}
      <ul className="mt-6 space-y-3">
        {addresses.map((a) => (
          <li key={a.id} className="card flex items-start justify-between gap-3 p-4">
            <div><p className="font-bold">{a.label}</p><p className="text-sm text-stone-600">{a.full_address}</p></div>
            <button
              className="text-sm font-bold text-brand-red"
              onClick={async () => { await createClient().from("addresses").delete().eq("id", a.id); load(); }}
            >Delete</button>
          </li>
        ))}
      </ul>
      {addresses.length < 5 && (
        <form
          className="card mt-6 space-y-4 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = Object.fromEntries(new FormData(e.currentTarget));
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { error } = await supabase.from("addresses").insert({
              customer_id: user.id,
              label: String(fd.label || "Home").slice(0, 30),
              full_address: String(fd.full_address).slice(0, 300),
            });
            if (error) toast.error("Couldn't save address");
            else { toast.success("Address added"); (e.target as HTMLFormElement).reset(); load(); }
          }}
        >
          <h2 className="font-display font-bold">Add address</h2>
          <div><label className="label" htmlFor="label">Label</label><input id="label" name="label" placeholder="Home" className="input" /></div>
          <div><label className="label" htmlFor="full_address">Full address</label><textarea id="full_address" name="full_address" required rows={3} maxLength={300} className="input" /></div>
          <button className="btn-primary">Save address</button>
        </form>
      )}
    </div>
  );
}
