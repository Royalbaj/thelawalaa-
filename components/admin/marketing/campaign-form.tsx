"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import { saveCampaign } from "@/app/actions/marketing";
import { CHANNELS, LANDINGS, slugify, type Channel, type Landing } from "@/lib/marketing-shared";
import { SITE } from "@/lib/seo";

export type CampaignInput = {
  id?: string; name: string; channel: Channel; code: string; landing_path: Landing; promo_code_id: string | null;
  budget: number | null; starts_on: string; ends_on: string | null; notes: string | null;
};
export const nepalTodayYmd = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" });

/** New / edit campaign — a sheet over the page. */
export default function CampaignForm({ initial, promos, onClose }: {
  initial?: CampaignInput; promos: { id: string; code: string; active: boolean }[]; onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [codeTouched, setCodeTouched] = useState(!!initial);
  const [channel, setChannel] = useState<Channel>(initial?.channel ?? "facebook");
  const [landing, setLanding] = useState<Landing>(initial?.landing_path ?? "/");
  const [promo, setPromo] = useState(initial?.promo_code_id ?? "");
  const [budget, setBudget] = useState(initial?.budget != null ? String(initial.budget) : "");
  const [startsOn, setStartsOn] = useState(initial?.starts_on ?? nepalTodayYmd());
  const [endsOn, setEndsOn] = useState(initial?.ends_on ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const linkCode = codeTouched ? code : slugify(name);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await saveCampaign(initial?.id ?? null, {
        name, channel, code: linkCode, landing_path: landing, promo_code_id: promo || null,
        budget: budget ? Number(budget) : null, starts_on: startsOn, ends_on: endsOn || null, notes,
      });
      if ("error" in r && r.error) { toast.error(r.error); return; }
      toast.success(initial ? "Campaign saved" : "Campaign created — share its link or QR");
      router.refresh();
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={initial ? "Edit campaign" : "New campaign"}>
      <form onSubmit={submit} className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-brand-brown">{initial ? "Edit campaign" : "New campaign"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div><label className="label" htmlFor="c-name">Name</label>
            <input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Dashain Facebook ads" required /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="c-channel">Channel</label>
              <select id="c-channel" className="input" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
                {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className="label" htmlFor="c-landing">Link opens</label>
              <select id="c-landing" className="input" value={landing} onChange={(e) => setLanding(e.target.value as Landing)}>
                {Object.entries(LANDINGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
          </div>
          <div>
            <label className="label" htmlFor="c-code">Tracking link</label>
            <div className="flex items-center overflow-hidden rounded-xl border border-stone-300 focus-within:border-brand-orange focus-within:ring-2 focus-within:ring-brand-orange/30">
              <span className="shrink-0 bg-stone-50 px-3 py-2.5 text-sm text-stone-500">{SITE.url.replace(/^https?:\/\//, "")}/go/</span>
              <input id="c-code" className="min-w-0 flex-1 px-2 py-2.5 text-base outline-none sm:text-sm" value={linkCode} maxLength={30}
                onChange={(e) => { setCodeTouched(true); setCode(slugify(e.target.value)); }} />
            </div>
            <p className="mt-1 text-xs text-stone-500">Put this link (or its QR) in the ad or poster — visits, orders and sign-ups through it count for this campaign.</p>
          </div>
          <div><label className="label" htmlFor="c-promo">Promo code <span className="font-normal text-stone-400">(optional — orders using it count too)</span></label>
            <select id="c-promo" className="input" value={promo} onChange={(e) => setPromo(e.target.value)}>
              <option value="">None</option>
              {promos.map((p) => <option key={p.id} value={p.id}>{p.code}{p.active ? "" : " (switched off)"}</option>)}
            </select>
            <p className="mt-1 text-xs text-stone-500">Make codes in Admin → Settings → Promo codes.</p></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1"><label className="label" htmlFor="c-budget">Budget (Rs)</label>
              <input id="c-budget" className="input" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} placeholder="5000" /></div>
            <div><label className="label" htmlFor="c-start">Starts</label>
              <input id="c-start" type="date" className="input !px-2" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required /></div>
            <div><label className="label" htmlFor="c-end">Ends</label>
              <input id="c-end" type="date" className="input !px-2" value={endsOn} min={startsOn} onChange={(e) => setEndsOn(e.target.value)} /></div>
          </div>
          <div><label className="label" htmlFor="c-notes">Notes</label>
            <textarea id="c-notes" className="input" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Audience, creative, where the posters went…" /></div>
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-full py-3 font-bold text-stone-600 ring-1 ring-stone-200">Cancel</button>
          <button disabled={pending || name.trim().length < 2 || linkCode.length < 2} className="btn-primary flex-[2]">{pending ? "Saving…" : initial ? "Save" : "Create campaign"}</button>
        </div>
      </form>
    </div>
  );
}
