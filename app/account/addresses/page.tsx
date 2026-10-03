"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { LocateFixed, Loader2, MapPin, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Address = { id: string; label: string; full_address: string; lat: number | null; lng: number | null };

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const load = () =>
    createClient().from("addresses").select("id, label, full_address, lat, lng").order("created_at").then(({ data }) => setAddresses((data as Address[]) ?? []));
  useEffect(() => { load(); }, []);

  function locate() {
    if (!("geolocation" in navigator)) { toast.error("This phone can't share its location"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { setLocating(false); toast.error("Couldn't get your location — allow it in your browser settings"); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  return (
    <div className="pb-4">
      <h1 className="font-display text-2xl font-extrabold text-brand-brown">Saved addresses</h1>
      <p className="text-sm text-stone-500">Pick one at checkout for home delivery. Up to 5.</p>
      {addresses.length === 0 && (
        <p className="mt-6 rounded-3xl bg-white p-6 text-center text-sm text-stone-400 shadow-sm ring-1 ring-stone-100">No saved addresses yet.</p>
      )}
      <ul className="mt-6 space-y-3">
        {addresses.map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
            <div>
              <p className="flex items-center gap-2 font-bold">{a.label}
                {a.lat != null && <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700"><MapPin size={10} /> Pinned</span>}
              </p>
              <p className="text-sm text-stone-600">{a.full_address}</p>
            </div>
            <button
              className="text-sm font-bold text-brand-red"
              onClick={async () => { await createClient().from("addresses").delete().eq("id", a.id); load(); }}
            >Delete</button>
          </li>
        ))}
      </ul>
      {addresses.length < 5 && (
        <form
          className="mt-6 space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-100"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = Object.fromEntries(new FormData(form));
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { error } = await supabase.from("addresses").insert({
              customer_id: user.id,
              label: String(fd.label || "Home").slice(0, 30),
              full_address: String(fd.full_address).slice(0, 300),
              lat: pin?.lat ?? null,
              lng: pin?.lng ?? null,
            });
            if (error) toast.error("Couldn't save address");
            else { toast.success("Address added"); form.reset(); setPin(null); load(); }
          }}
        >
          <h2 className="font-display font-bold">Add address</h2>
          <div><label className="label" htmlFor="label">Label</label><input id="label" name="label" placeholder="Home" className="input" /></div>
          <div><label className="label" htmlFor="full_address">Full address</label><textarea id="full_address" name="full_address" required minLength={10} rows={3} maxLength={300} placeholder="Tole / street, house or building, nearest landmark" className="input" /></div>
          {pin ? (
            <p className="flex items-center justify-between gap-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-bold text-green-800">
              <span className="flex items-center gap-1.5"><MapPin size={15} /> Location pinned — riders get a map to it</span>
              <button type="button" onClick={() => setPin(null)} aria-label="Remove pin" className="text-green-700"><X size={16} /></button>
            </p>
          ) : (
            <button type="button" onClick={locate} disabled={locating} className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-bold text-brand-orange ring-1 ring-orange-200 hover:bg-orange-50">
              {locating ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />} {locating ? "Finding you…" : "I'm here now — pin my location"}
            </button>
          )}
          <button className="btn-primary">Save address</button>
        </form>
      )}
    </div>
  );
}
