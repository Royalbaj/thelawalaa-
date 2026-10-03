"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Navigation, Phone, MapPin, Package, Banknote, QrCode, CheckCircle2, KeyRound, MessageSquareText, Map as MapIcon } from "lucide-react";
import { driverAdvanceStatus, verifyDeliveryOtp, getCustomerTelLink } from "@/app/actions/delivery";
import { directionsUrl, embedUrl, searchUrl, distanceKm, fmtKm, STORE } from "@/lib/geo";
import type { DriverJob } from "@/lib/driver-jobs";
import { npr, cn } from "@/lib/utils";

const STEPS = [
  { key: "assigned", label: "Assigned" },
  { key: "picked_up", label: "Picked up" },
  { key: "on_the_way", label: "On the way" },
  { key: "delivered", label: "Delivered" },
];

export default function JobCard({ job }: { job: DriverJob }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [showMap, setShowMap] = useState(job.status !== "assigned");
  const at = STEPS.findIndex((s) => s.key === job.status);
  const no = job.dailyNumber != null ? `#${String(job.dailyNumber).padStart(2, "0")}` : job.orderNumber;
  const itemCount = job.items.reduce((n, i) => n + i.qty, 0);

  const advance = () => start(async () => {
    const r = await driverAdvanceStatus(job.orderId);
    if ("error" in r && r.error) { toast.error(r.error); return; }
    toast.success(r.status === "picked_up" ? "Picked up — head out when ready" : "On the way — the customer can see it");
    if (r.status === "on_the_way" && job.pin) window.open(directionsUrl(job.pin), "_blank", "noopener");
    router.refresh();
  });

  const confirm = () => start(async () => {
    const r = await verifyDeliveryOtp(job.orderId, code);
    if ("error" in r && r.error) { toast.error(r.error); setCode(""); return; }
    toast.success("Delivered! Great job 🎉");
    setCodeOpen(false);
    router.refresh();
  });

  const call = () => start(async () => {
    // The number is fetched on tap — it's never in this page.
    const r = await getCustomerTelLink(job.orderId);
    if ("error" in r && r.error) toast.error(r.error);
    else if ("tel" in r && r.tel) window.location.href = r.tel;
  });

  return (
    <article className="overflow-hidden rounded-3xl bg-white/[0.06] ring-1 ring-white/10">
      {/* Progress */}
      <div className="grid grid-cols-4 gap-1 px-4 pt-4">
        {STEPS.map((s, i) => (
          <div key={s.key}>
            <div className={cn("h-1.5 rounded-full", i <= at ? "bg-brand-orange" : "bg-white/10")} />
            <p className={cn("mt-1 text-[10px] font-bold", i === at ? "text-orange-300" : i < at ? "text-white/60" : "text-white/30")}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-3xl font-extrabold leading-none text-white">{no}</p>
            <p className="mt-1 font-mono text-[11px] text-white/40">{job.orderNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-white">{job.firstName}</p>
            <button onClick={call} disabled={pending}
              className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-white/20">
              <Phone size={14} /> Call
            </button>
          </div>
        </div>

        {/* What to collect at the door — only while the delivery is open */}
        <div className={cn("flex items-center gap-3 rounded-2xl px-4 py-3",
          job.collect == null ? "bg-green-500/15 text-green-300" : "bg-amber-500/15 text-amber-200")}>
          {job.collect == null ? <CheckCircle2 size={20} /> : job.paymentMethod === "qr" ? <QrCode size={20} /> : <Banknote size={20} />}
          <p className="text-sm font-bold">
            {job.collect == null ? "Already paid — nothing to collect"
              : job.paymentMethod === "qr" ? <>Customer pays <span className="text-lg">{npr(job.collect)}</span> by QR</>
              : <>Collect <span className="text-lg">{npr(job.collect)}</span> cash</>}
          </p>
        </div>

        {/* The bag */}
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/40"><Package size={13} /> Check the bag · {itemCount} item{itemCount === 1 ? "" : "s"}</p>
          <ul className="space-y-1 text-sm text-white/85">
            {job.items.map((i, k) => <li key={k} className="flex gap-2"><span className="w-7 shrink-0 font-bold text-orange-300">{i.qty}×</span>{i.name}</li>)}
          </ul>
        </div>

        {job.note && (
          <p className="flex gap-2 rounded-2xl bg-white/5 px-3 py-2.5 text-sm text-white/80"><MessageSquareText size={16} className="mt-0.5 shrink-0 text-white/40" /> {job.note}</p>
        )}

        {/* Where to */}
        <div className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
          <div className="flex items-start gap-2 p-3">
            <MapPin size={18} className="mt-0.5 shrink-0 text-brand-orange" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">{job.address || "Location shared by the customer"}</p>
              <p className="text-xs text-white/45">
                {job.pin
                  ? `Exact pin shared · ${fmtKm(distanceKm(STORE, job.pin))} from the shop${job.pin.accuracy ? ` · ±${job.pin.accuracy} m` : ""}`
                  : "No pin — follow the address and call if unsure"}
              </p>
            </div>
          </div>
          {job.pin && showMap && (
            <iframe title={`Map for ${no}`} src={embedUrl(job.pin)} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
              className="block h-52 w-full border-0" />
          )}
          <div className="grid grid-cols-2 gap-px bg-white/10">
            {job.pin ? (
              <>
                <a href={directionsUrl(job.pin)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-stone-900 py-3 text-sm font-bold text-white hover:bg-stone-800"><Navigation size={15} /> Navigate</a>
                <button onClick={() => setShowMap((v) => !v)}
                  className="flex items-center justify-center gap-1.5 bg-stone-900 py-3 text-sm font-bold text-white/80 hover:bg-stone-800"><MapIcon size={15} /> {showMap ? "Hide map" : "Show map"}</button>
              </>
            ) : (
              <a href={searchUrl(job.address ?? "")} target="_blank" rel="noopener noreferrer"
                className="col-span-2 flex items-center justify-center gap-1.5 bg-stone-900 py-3 text-sm font-bold text-white hover:bg-stone-800"><Navigation size={15} /> Find in Google Maps</a>
            )}
          </div>
        </div>

        {/* The one next step */}
        {job.status === "assigned" && (
          <button onClick={advance} disabled={pending} className="w-full rounded-2xl bg-brand-orange py-4 text-base font-extrabold text-white transition active:scale-[0.98] disabled:opacity-60">
            {pending ? "Saving…" : "I've picked it up from the shop"}
          </button>
        )}
        {job.status === "picked_up" && (
          <button onClick={advance} disabled={pending} className="w-full rounded-2xl bg-sky-600 py-4 text-base font-extrabold text-white transition active:scale-[0.98] disabled:opacity-60">
            {pending ? "Saving…" : "Start — I'm on the way"}
          </button>
        )}
        {job.status === "on_the_way" && !codeOpen && (
          <button onClick={() => { setCodeOpen(true); setCode(""); }} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-green py-4 text-base font-extrabold text-white transition active:scale-[0.98]">
            <KeyRound size={18} /> Hand over — enter the code
          </button>
        )}
        {job.status === "on_the_way" && codeOpen && (
          <div className="space-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
            <p className="text-center text-sm font-bold text-white">Ask the customer for their 2-digit delivery code</p>
            <p className="text-center text-xs text-white/45">It&apos;s on their order screen and in their email.{job.otpAttemptsLeft < 3 ? ` ${job.otpAttemptsLeft} ${job.otpAttemptsLeft === 1 ? "try" : "tries"} left.` : ""}</p>
            <input value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={2} autoFocus aria-label="Delivery code"
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 2))}
              onKeyDown={(e) => { if (e.key === "Enter" && code.length === 2) confirm(); }}
              className="w-full rounded-2xl border border-white/15 bg-black/30 py-3 text-center font-mono text-3xl font-extrabold tracking-[0.6em] text-white outline-none focus:border-brand-orange" />
            <div className="flex gap-2">
              <button onClick={() => setCodeOpen(false)} className="flex-1 rounded-2xl bg-white/10 py-3 text-sm font-bold text-white">Back</button>
              <button onClick={confirm} disabled={pending || code.length !== 2} className="flex-[2] rounded-2xl bg-brand-green py-3 text-sm font-extrabold text-white disabled:opacity-50">
                {pending ? "Checking…" : "Confirm delivery"}
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
