"use client";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Trash2, Pencil, Plus, X } from "lucide-react";
import { addFaq, updateFaq, setFaqActive, deleteFaq } from "@/app/actions/faqs";

type Faq = { id: string; question: string; answer: string; is_active: boolean };

export default function FaqControls({ faqs }: { faqs: Faq[] }) {
  const [pending, start] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-brand-brown">FAQs</h1>
        <button onClick={() => { setShowAdd((s) => !s); setEditingId(null); }} className="flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2 text-sm font-bold text-white hover:brightness-110 transition">
          {showAdd ? <X size={15} /> : <Plus size={15} />} {showAdd ? "Cancel" : "Add FAQ"}
        </button>
      </div>

      {showAdd && (
        <form
          className="card space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = Object.fromEntries(new FormData(form));
            start(async () => {
              const r = await addFaq(fd);
              if (r?.error) toast.error(r.error);
              else { toast.success("FAQ added"); form.reset(); setShowAdd(false); }
            });
          }}
        >
          <input name="question" required placeholder="Question" className="input" maxLength={200} />
          <textarea name="answer" required placeholder="Answer" rows={3} className="input" maxLength={1000} />
          <button disabled={pending} className="btn-primary w-full">{pending ? "Adding…" : "Add FAQ"}</button>
        </form>
      )}

      <div className="card divide-y divide-orange-50">
        {faqs.map((f) => (
          <div key={f.id} className="p-4">
            {editingId === f.id ? (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const fd = Object.fromEntries(new FormData(form));
                  start(async () => {
                    const r = await updateFaq(f.id, fd);
                    if (r?.error) toast.error(r.error);
                    else { toast.success("Updated"); setEditingId(null); }
                  });
                }}
              >
                <input name="question" required defaultValue={f.question} className="input" maxLength={200} />
                <textarea name="answer" required defaultValue={f.answer} rows={3} className="input" maxLength={1000} />
                <div className="flex gap-2">
                  <button disabled={pending} className="btn-primary flex-1">{pending ? "Saving…" : "Save"}</button>
                  <button type="button" onClick={() => setEditingId(null)} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-bold text-stone-500 hover:bg-stone-50">Cancel</button>
                </div>
              </form>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-brand-brown">{f.question}</p>
                  <p className="mt-1 text-sm text-stone-500">{f.answer}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    disabled={pending}
                    onClick={() => start(async () => {
                      const r = await setFaqActive(f.id, !f.is_active);
                      r?.error ? toast.error(r.error) : toast.success("Updated");
                    })}
                    className={f.is_active ? "badge bg-green-100 text-green-800" : "badge bg-stone-200 text-stone-600"}
                  >
                    {f.is_active ? "On" : "Off"}
                  </button>
                  <button onClick={() => { setEditingId(f.id); setShowAdd(false); }} className="text-stone-400 hover:text-brand-orange transition">
                    <Pencil size={15} />
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => {
                      if (!confirm("Delete this FAQ?")) return;
                      start(async () => {
                        const r = await deleteFaq(f.id);
                        r?.error ? toast.error(r.error) : toast.success("Removed");
                      });
                    }}
                    className="text-stone-400 hover:text-brand-red transition"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {faqs.length === 0 && <p className="px-4 py-8 text-center text-sm text-stone-500">No FAQs yet.</p>}
      </div>
    </div>
  );
}
