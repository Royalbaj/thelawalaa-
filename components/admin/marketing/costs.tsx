"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Receipt, Trash2 } from "lucide-react";
import { addMarketingCost, deleteMarketingCost, saveMarketingSettings } from "@/app/actions/marketing";
import { npr } from "@/lib/utils";
import { nepalTodayYmd } from "./campaign-form";

/** "Log a cost": every rupee spent on a campaign — ad top-ups, printing, the influencer, prizes. */
export function CostForm({ campaigns }: { campaigns: { id: string; name: string; status: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const live = campaigns.filter((c) => c.status !== "ended");
  const [campaignId, setCampaignId] = useState(live[0]?.id ?? campaigns[0]?.id ?? "");
  const [date, setDate] = useState(nepalTodayYmd());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  if (!campaigns.length) return <p className="text-sm text-stone-500">Create a campaign first, then log what you spend on it here.</p>;
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await addMarketingCost({ campaign_id: campaignId, spent_on: date, amount: Number(amount), note });
        if ("error" in r && r.error) { toast.error(r.error); return; }
        toast.success(`Logged ${npr(Number(amount))}`);
        setAmount(""); setNote("");
        router.refresh();
      });
    }}>
      <div><label className="label" htmlFor="k-campaign">Campaign</label>
        <select id="k-campaign" className="input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          {[...live, ...campaigns.filter((c) => c.status === "ended")].map((c) => <option key={c.id} value={c.id}>{c.name}{c.status === "ended" ? " (ended)" : ""}</option>)}
        </select></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="k-amount">Amount (Rs)</label>
          <input id="k-amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="1500" required /></div>
        <div><label className="label" htmlFor="k-date">Date</label>
          <input id="k-date" type="date" className="input !px-2" value={date} max={nepalTodayYmd()} onChange={(e) => setDate(e.target.value)} required /></div>
      </div>
      <div><label className="label" htmlFor="k-note">What for <span className="font-normal text-stone-400">(optional)</span></label>
        <input id="k-note" className="input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facebook boost, 200 posters printed…" /></div>
      <button disabled={pending || !amount || Number(amount) <= 0} className="btn-primary w-full !py-2.5 text-sm"><Receipt size={16} /> {pending ? "Saving…" : "Log cost"}</button>
    </form>
  );
}

export function CostList({ costs }: { costs: { id: string; spent_on: string; amount: number; note: string | null; campaign: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!costs.length) return <p className="py-6 text-center text-sm text-stone-400">No costs logged yet.</p>;
  return (
    <ul className="divide-y divide-stone-100">
      {costs.map((k) => (
        <li key={k.id} className="flex items-center gap-3 py-2.5 text-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-stone-700">{k.campaign}</p>
            <p className="truncate text-xs text-stone-500">{k.spent_on}{k.note ? ` · ${k.note}` : ""}</p>
          </div>
          <b className="shrink-0 tabular-nums text-brand-brown">{npr(k.amount)}</b>
          <button disabled={pending} aria-label="Delete this cost" onClick={() => {
            if (confirm(`Delete this ${npr(k.amount)} cost?`)) start(async () => { await deleteMarketingCost(k.id); router.refresh(); });
          }} className="shrink-0 rounded-full p-1.5 text-stone-300 hover:bg-red-50 hover:text-brand-red"><Trash2 size={14} /></button>
        </li>
      ))}
    </ul>
  );
}

/** Gross margin (for profit) and the monthly marketing budget (for the alerts). */
export function MarketingSettingsForm({ margin, monthlyBudget }: { margin: number; monthlyBudget: number | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [m, setM] = useState(String(margin));
  const [b, setB] = useState(monthlyBudget != null ? String(monthlyBudget) : "");
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await saveMarketingSettings({ gross_margin_pct: Number(m), monthly_budget: b ? Number(b) : null });
        if ("error" in r && r.error) toast.error(r.error); else { toast.success("Saved"); router.refresh(); }
      });
    }}>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="s-margin">Gross margin %</label>
          <input id="s-margin" className="input" inputMode="decimal" value={m} onChange={(e) => setM(e.target.value.replace(/[^\d.]/g, ""))} /></div>
        <div><label className="label" htmlFor="s-budget">Monthly budget (Rs)</label>
          <input id="s-budget" className="input" inputMode="numeric" value={b} onChange={(e) => setB(e.target.value.replace(/[^\d.]/g, ""))} placeholder="No limit" /></div>
      </div>
      <p className="text-xs text-stone-500">Gross margin = what&apos;s left of each Rs 100 sold after ingredients, packaging and other per-order costs. Used for profit and ROI.</p>
      <button disabled={pending} className="w-full rounded-full py-2.5 text-sm font-bold text-brand-brown ring-1 ring-stone-200 hover:bg-stone-50">{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
