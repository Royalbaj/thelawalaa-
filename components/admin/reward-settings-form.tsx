"use client";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { saveRewardSettings } from "@/app/actions/rewards";
import { pointsForTotal, fmtPoints, fmtRupees, type RewardSettings } from "@/lib/rewards";
import { cn } from "@/lib/utils";

/** The rules, written as sentences with the numbers to fill in — and a live example underneath. */
export default function RewardSettingsForm({ initial, products }: { initial: RewardSettings; products: { id: string; name: string }[] }) {
  const [s, setS] = useState(initial);
  const [pending, start] = useTransition();
  const set = <K extends keyof RewardSettings>(k: K, v: RewardSettings[K]) => setS((cur) => ({ ...cur, [k]: v }));
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const freeName = products.find((p) => p.id === s.free_item_product_id)?.name ?? "item";
  const example = 290;
  const box = "inline-block w-20 rounded-lg border border-stone-300 px-2 py-1 text-center font-bold text-brand-brown outline-none focus:border-brand-orange";

  return (
    <form className="space-y-5" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await saveRewardSettings(s);
        if (r?.error) toast.error(r.error); else toast.success("Rewards updated — applies from the next paid order");
      });
    }}>
      <label className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 p-4">
        <span><b className="text-brand-brown">Rewards are {s.enabled ? "ON" : "OFF"}</b><span className="block text-xs text-stone-500">Off: nothing is earned or used, and customers don&apos;t see it at checkout.</span></span>
        <input type="checkbox" checked={s.enabled} onChange={(e) => set("enabled", e.target.checked)} className="h-6 w-6 accent-brand-orange" />
      </label>

      <fieldset disabled={!s.enabled} className={cn("space-y-4 text-sm text-stone-700", !s.enabled && "opacity-50")}>
        <p className="leading-9">For every <b>Rs 100</b> a customer pays, give them points worth{" "}
          <span className="whitespace-nowrap">Rs <input inputMode="decimal" value={s.earn_rupees_per_100} onChange={(e) => set("earn_rupees_per_100", num(e.target.value))} className={box} /></span>.
        </p>
        <p className="leading-9"><input inputMode="numeric" value={s.points_per_rupee} onChange={(e) => set("points_per_rupee", num(e.target.value))} className={box} /> points are worth <b>Rs 1</b>
          <span className="text-stone-500"> — so 1,000 points = {fmtRupees(1000 / Math.max(1, s.points_per_rupee))}</span>.
        </p>
        <p className="leading-9">Customers can use points once they have{" "}
          <input inputMode="numeric" value={s.min_redeem_points} onChange={(e) => set("min_redeem_points", num(e.target.value))} className={box} /> points
          <span className="text-stone-500"> ({fmtRupees(s.min_redeem_points / Math.max(1, s.points_per_rupee))})</span>.
        </p>
        <p className="leading-9">New customers get <input inputMode="numeric" value={s.welcome_points} onChange={(e) => set("welcome_points", num(e.target.value))} className={box} /> welcome points.</p>

        <div className="rounded-2xl bg-stone-50 p-4">
          <label className="flex items-center justify-between gap-3">
            <b className="text-brand-brown">Free item for regulars</b>
            <input type="checkbox" checked={s.free_item_enabled} onChange={(e) => set("free_item_enabled", e.target.checked)} className="h-5 w-5 accent-brand-orange" />
          </label>
          <p className={cn("mt-2 leading-9", !s.free_item_enabled && "opacity-50")}>
            Every <input inputMode="numeric" disabled={!s.free_item_enabled} value={s.free_item_orders} onChange={(e) => set("free_item_orders", num(e.target.value))} className={box} /> paid orders earn a free{" "}
            <select disabled={!s.free_item_enabled} value={s.free_item_product_id ?? ""} onChange={(e) => set("free_item_product_id", e.target.value || null)}
              className="rounded-lg border border-stone-300 px-2 py-1 font-bold text-brand-brown">
              <option value="">— pick an item —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </p>
        </div>
      </fieldset>

      {s.enabled && (
        <div className="rounded-2xl bg-orange-50 p-4 text-sm text-brand-brown ring-1 ring-orange-100">
          <b>Example:</b> a Rs {example} order earns <b>{fmtPoints(pointsForTotal(example, s))} points</b> ({fmtRupees(pointsForTotal(example, s) / Math.max(1, s.points_per_rupee))}).
          {" "}About {fmtRupees(Math.ceil((s.min_redeem_points / Math.max(1, s.points_per_rupee)) / Math.max(0.01, s.earn_rupees_per_100) * 100))} of orders unlocks their first {fmtRupees(s.min_redeem_points / Math.max(1, s.points_per_rupee))} off
          {s.free_item_enabled && <>, and every {s.free_item_orders}th order brings a free {freeName}</>}.
        </div>
      )}

      <button disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save rewards"}</button>
    </form>
  );
}
