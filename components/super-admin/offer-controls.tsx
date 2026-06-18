"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createOffer, setOfferActive, deleteOffer } from "@/app/actions/offers";

interface Offer {
  id: string;
  title: string;
  description: string | null;
  offer_type: string;
  discount_label: string | null;
  is_active: boolean;
  target_audience: string;
  ends_at: string | null;
  created_at: string;
}

export default function OfferControls({ offers }: { offers: Offer[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createOffer(Object.fromEntries(fd));
      if ("error" in res) return toast.error(res.error);
      toast.success("Offer created!");
      setShowForm(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(!showForm)} className="rounded-xl bg-amber-500 text-white px-4 py-2.5 text-sm font-bold hover:brightness-110 transition">
        {showForm ? "Cancel" : "+ Create New Offer"}
      </button>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl bg-white border border-stone-200 p-5 space-y-3">
          <div>
            <label className="label">Title *</label>
            <input name="title" required className="input" placeholder="e.g. Buy 1 Get 1 Free Chatpate!" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea name="description" className="input" rows={2} placeholder="Offer details..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type *</label>
              <select name="offer_type" className="input">
                <option value="deal">Deal</option>
                <option value="banner">Banner</option>
                <option value="reward">Loyalty Reward</option>
              </select>
            </div>
            <div>
              <label className="label">Discount Label</label>
              <input name="discount_label" className="input" placeholder="e.g. 20% OFF" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Target Audience</label>
              <select name="target_audience" className="input">
                <option value="all">All Customers</option>
                <option value="new">New Customers</option>
                <option value="returning">Returning</option>
                <option value="loyalty">Loyalty Members</option>
              </select>
            </div>
            <div>
              <label className="label">Expires At</label>
              <input name="ends_at" type="datetime-local" className="input" />
            </div>
          </div>
          <button type="submit" disabled={isPending} className="btn-primary w-full">{isPending ? "Creating…" : "Create Offer"}</button>
        </form>
      )}

      {/* Offers List */}
      <div className="space-y-3">
        {offers.map((o) => (
          <div key={o.id} className={`rounded-2xl border p-4 flex items-center justify-between ${o.is_active ? "bg-white border-stone-200" : "bg-stone-50 border-stone-100 opacity-60"}`}>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-brand-brown">{o.title}</p>
                <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${o.offer_type === "deal" ? "bg-green-100 text-green-700" : o.offer_type === "banner" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                  {o.offer_type}
                </span>
                {o.discount_label && (
                  <span className="text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">{o.discount_label}</span>
                )}
              </div>
              {o.description && <p className="text-xs text-stone-500 mt-0.5">{o.description}</p>}
              <p className="text-[10px] text-stone-400 mt-1">Audience: {o.target_audience} · Created: {new Date(o.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { startTransition(async () => { await setOfferActive(o.id, !o.is_active); router.refresh(); }); }}
                className={`text-xs font-bold rounded-lg px-3 py-1.5 ${o.is_active ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}
              >
                {o.is_active ? "Pause" : "Activate"}
              </button>
              <button
                onClick={() => { if (confirm("Delete this offer?")) startTransition(async () => { await deleteOffer(o.id); router.refresh(); }); }}
                className="text-xs font-bold rounded-lg px-3 py-1.5 bg-red-50 text-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {offers.length === 0 && (
          <div className="rounded-2xl bg-white border border-stone-200 p-8 text-center">
            <p className="text-3xl mb-2">🎁</p>
            <p className="text-sm font-bold text-stone-500">No offers yet</p>
            <p className="text-xs text-stone-400 mt-1">Create your first offer to attract customers!</p>
          </div>
        )}
      </div>
    </div>
  );
}
