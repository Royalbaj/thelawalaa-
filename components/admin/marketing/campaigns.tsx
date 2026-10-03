"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import QRCode from "qrcode";
import { Plus, Copy, QrCode, Pencil, Trash2, X, Download, MousePointerClick, ShoppingBag, UserPlus, Megaphone } from "lucide-react";
import { setCampaignStatus, deleteCampaign } from "@/app/actions/marketing";
import { CHANNELS, LANDINGS, pct, times } from "@/lib/marketing-shared";
import type { CampaignRow } from "@/lib/marketing";
import { SITE } from "@/lib/seo";
import { npr, cn } from "@/lib/utils";
import CampaignForm from "./campaign-form";

type Promo = { id: string; code: string; active: boolean };
const linkFor = (code: string) => `${SITE.url}/go/${code}`;

export function NewCampaignButton({ promos }: { promos: Promo[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary !px-5 !py-2.5 text-sm"><Plus size={16} /> New campaign</button>
      {open && <CampaignForm promos={promos} onClose={() => setOpen(false)} />}
    </>
  );
}

function QrSheet({ c, onClose }: { c: CampaignRow; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(linkFor(c.code), { width: 720, margin: 2, color: { dark: "#78350F", light: "#FFFFFF" }, errorCorrectionLevel: "M" })
      .then(setSrc).catch(() => toast.error("Couldn't make the QR code"));
  }, [c.code]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="QR code">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-center shadow-2xl">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display font-bold text-brand-brown">{c.name}</p>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100"><X size={18} /></button>
        </div>
        {src ? <img src={src} alt={`QR code for ${linkFor(c.code)}`} className="mx-auto w-64 rounded-xl" /> : <div className="mx-auto h-64 w-64 animate-pulse rounded-xl bg-stone-100" />}
        <p className="mt-2 break-all font-mono text-xs text-stone-500">{linkFor(c.code)}</p>
        <p className="mt-1 text-xs text-stone-400">Scans count as visits for this campaign.</p>
        {src && <a href={src} download={`thelawalaa-${c.code}-qr.png`} className="btn-primary mt-4 w-full !py-2.5 text-sm"><Download size={16} /> Download for printing</a>}
      </div>
    </div>
  );
}

const STATUS_LABEL = { active: "Running", paused: "Paused", ended: "Ended" } as const;
const STATUS = {
  active: "bg-green-100 text-green-800",
  paused: "bg-amber-100 text-amber-800",
  ended: "bg-stone-200 text-stone-600",
} as const;

function Stat({ icon: Icon, label, value }: { icon: typeof ShoppingBag; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-2.5 py-2">
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-stone-400"><Icon size={11} /> {label}</p>
      <p className="text-sm font-extrabold text-stone-800">{value}</p>
    </div>
  );
}

export function CampaignCard({ c, promos }: { c: CampaignRow; promos: Promo[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [qr, setQr] = useState(false);
  const roi = c.m.roi;
  const budgetUse = c.budget ? c.spend / c.budget : null;

  const status = (s: "active" | "paused" | "ended") => start(async () => {
    const r = await setCampaignStatus(c.id, s);
    if ("error" in r && r.error) toast.error(r.error); else { toast.success(s === "active" ? "Campaign running" : s === "paused" ? "Paused" : "Ended"); router.refresh(); }
  });
  const remove = () => {
    if (!confirm(`Delete “${c.name}” and its ${c.spend ? "cost entries" : "data"}? Orders it brought stay, without the link.`)) return;
    start(async () => { await deleteCampaign(c.id); toast.success("Deleted"); router.refresh(); });
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(linkFor(c.code)); toast.success("Link copied"); } catch { toast.error("Couldn't copy — select the link and copy it"); }
  };

  return (
    <article className={cn("rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100", c.status === "ended" && "opacity-75")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display font-bold text-brand-brown">{c.name}</p>
          <p className="text-xs text-stone-500">
            {CHANNELS[c.channel]} · from {c.starts_on}{c.ends_on ? ` to ${c.ends_on}` : ""}{c.promoCode ? ` · code ${c.promoCode}` : ""}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold", STATUS[c.status])}>{STATUS_LABEL[c.status]}</span>
      </div>

      {/* Money: spent vs budget, and what it brought back */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-orange-50 px-2 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700/70">Spent</p>
          <p className="font-display text-base font-extrabold text-brand-brown">{npr(c.spend)}</p>
        </div>
        <div className="rounded-xl bg-blue-50 px-2 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700/70">Brought in</p>
          <p className="font-display text-base font-extrabold text-blue-900">{npr(c.revenue)}</p>
        </div>
        <div className={cn("rounded-xl px-2 py-2", roi == null ? "bg-stone-50" : roi >= 0 ? "bg-green-50" : "bg-red-50")}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">ROI</p>
          <p className={cn("font-display text-base font-extrabold", roi == null ? "text-stone-400" : roi >= 0 ? "text-green-700" : "text-brand-red")}>{pct(roi)}</p>
        </div>
      </div>
      {c.budget != null && (
        <div className="mt-2">
          <div className="flex justify-between text-[11px] font-bold text-stone-500">
            <span>Budget {npr(c.budget)}</span>
            <span className={cn(budgetUse != null && budgetUse > 1 && "text-brand-red")}>{pct(budgetUse)} used</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-stone-100">
            <div className={cn("h-2 rounded-full", budgetUse != null && budgetUse > 1 ? "bg-brand-red" : budgetUse != null && budgetUse > 0.8 ? "bg-amber-500" : "bg-brand-orange")}
              style={{ width: `${Math.min(100, Math.max(2, (budgetUse ?? 0) * 100))}%` }} />
          </div>
        </div>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat icon={MousePointerClick} label="Visits" value={String(c.clicks)} />
        <Stat icon={ShoppingBag} label="Orders" value={String(c.orders)} />
        <Stat icon={UserPlus} label="Sign-ups" value={String(c.signups)} />
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-stone-500">
        <span>Return on spend <b className="text-stone-700">{times(c.m.roas)}</b></span>
        <span>Cost/order <b className="text-stone-700">{c.m.costPerOrder != null ? npr(Math.round(c.m.costPerOrder)) : "—"}</b></span>
        <span>Cost/sign-up <b className="text-stone-700">{c.m.costPerSignup != null ? npr(Math.round(c.m.costPerSignup)) : "—"}</b></span>
        {c.clicks > 0 && <span>Visit → order <b className="text-stone-700">{pct(c.m.conversion, 1)}</b></span>}
        {c.discounts > 0 && <span>Discounts given <b className="text-stone-700">{npr(c.discounts)}</b></span>}
        {c.m.breakEvenRevenue != null && c.spend > 0 && <span>Break-even at <b className="text-stone-700">{npr(Math.round(c.m.breakEvenRevenue))}</b> sales</span>}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-3">
        <button onClick={copy} className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold text-stone-600 ring-1 ring-stone-200 hover:text-brand-orange"><Copy size={13} /> Link</button>
        <button onClick={() => setQr(true)} className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold text-stone-600 ring-1 ring-stone-200 hover:text-brand-orange"><QrCode size={13} /> QR</button>
        <button onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold text-stone-600 ring-1 ring-stone-200 hover:text-brand-orange"><Pencil size={13} /> Edit</button>
        <select aria-label="Campaign status" disabled={pending} value={c.status} onChange={(e) => status(e.target.value as "active" | "paused" | "ended")}
          className="rounded-full border-0 bg-stone-100 py-1.5 pl-3 pr-7 text-xs font-bold text-stone-600">
          <option value="active">Running</option>
          <option value="paused">Paused</option>
          <option value="ended">Ended</option>
        </select>
        <button onClick={remove} disabled={pending} aria-label="Delete campaign" className="ml-auto rounded-full p-1.5 text-stone-300 hover:bg-red-50 hover:text-brand-red"><Trash2 size={15} /></button>
      </div>
      {c.notes && <p className="mt-2 text-xs text-stone-500">{c.notes}</p>}
      <p className="mt-1 text-[11px] text-stone-400">Link opens the {LANDINGS[c.landing_path].toLowerCase()}.</p>

      {editing && (
        <CampaignForm promos={promos} onClose={() => setEditing(false)} initial={{
          id: c.id, name: c.name, channel: c.channel, code: c.code, landing_path: c.landing_path, promo_code_id: c.promo_code_id,
          budget: c.budget, starts_on: c.starts_on, ends_on: c.ends_on, notes: c.notes,
        }} />
      )}
      {qr && <QrSheet c={c} onClose={() => setQr(false)} />}
    </article>
  );
}

export function NoCampaigns({ promos }: { promos: Promo[] }) {
  return (
    <div className="rounded-2xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-stone-100">
      <Megaphone size={30} className="mx-auto mb-2 text-stone-300" />
      <p className="font-bold text-stone-600">No campaigns yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">Add one for each ad, poster run or promotion. Log what you spend on it and this page shows what it brought back.</p>
      <div className="mt-4"><NewCampaignButton promos={promos} /></div>
    </div>
  );
}
