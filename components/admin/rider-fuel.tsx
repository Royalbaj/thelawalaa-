"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { updateFuelRate } from "@/app/actions/settings";
import { recalcTripDistances } from "@/app/actions/delivery";

/** Rs per km (there and back) for the riders' fuel money; empty = show km only. */
export function FuelRateForm({ rate }: { rate: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState(rate == null ? "" : String(rate));
  const [pending, start] = useTransition();
  const n = value.trim() === "" ? null : Number(value);
  const valid = n == null || (Number.isFinite(n) && n >= 0 && n <= 1000);
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
      e.preventDefault();
      if (!valid) { toast.error("Enter rupees per km, or leave it empty"); return; }
      start(async () => {
        const r = await updateFuelRate({ fuel_rate_per_km: n });
        if (r?.error) { toast.error(r.error); return; }
        toast.success(n == null ? "Fuel money hidden — km only" : `Fuel money: Rs ${n} per km`);
        router.refresh();
      });
    }}>
      <label className="text-sm font-bold text-stone-600">Fuel money (Rs per km)
        <input value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, "").slice(0, 6))} inputMode="decimal"
          placeholder="e.g. 5" className="input mt-1 !w-32 !py-1.5" />
      </label>
      <button disabled={pending || !valid || n === rate} className="btn-primary !px-4 !py-2 text-sm">{pending ? "Saving…" : "Save"}</button>
    </form>
  );
}

/** Work out road distances again for trips that only have a straight line (e.g. once a Google Maps key is set). */
export function RecalcDistances({ from, to, count }: { from: string; to: string; count: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button disabled={pending} className="text-xs font-bold text-brand-orange disabled:opacity-50"
      onClick={() => start(async () => {
        const r = await recalcTripDistances({ from, to });
        if ("error" in r) { toast.error(r.error ?? "Couldn't recalculate"); return; }
        toast[r.road ? "success" : "error"](r.road
          ? `${r.road} of ${r.checked} now by road`
          : "Google Maps didn't answer — still straight-line. A Google Maps key with the Routes API is needed (GOOGLE_MAPS_SERVER_KEY).");
        router.refresh();
      })}>
      {pending ? "Recalculating…" : `Recalculate road distance (${count})`}
    </button>
  );
}
