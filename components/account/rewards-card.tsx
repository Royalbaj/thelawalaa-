import Link from "next/link";
import { Sparkles, CupSoda } from "lucide-react";
import { fmtPoints, fmtRupees, pointsToRupees, redeemPlan, type RewardSettings } from "@/lib/rewards";

export type RewardsState = { points: number; freeItems: number; orderCount: number; settings: RewardSettings; freeItemName: string | null };

/** The member card: points, what they're worth, and how close the next reward is. */
export default function RewardsCard({ r, compact = false }: { r: RewardsState; compact?: boolean }) {
  const s = r.settings;
  const usable = redeemPlan(r.points, Number.MAX_SAFE_INTEGER, s);
  const toMin = Math.max(0, s.min_redeem_points - r.points);
  const stampPct = Math.min(100, (r.orderCount / s.free_item_orders) * 100);
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#2a1206] via-[#1C0A00] to-[#120700] p-5 text-amber-50 shadow-lg">
      <div aria-hidden className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-brand-orange/25 blur-2xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-200/70">Thelawalaa Rewards</p>
            <p className="mt-2 font-display text-4xl font-extrabold">{fmtPoints(r.points)} <span className="text-base font-bold text-amber-200/80">points</span></p>
            <p className="text-sm text-amber-100/70">worth {fmtRupees(pointsToRupees(r.points, s))}</p>
          </div>
          <Sparkles className="shrink-0 text-brand-yellow" size={26} />
        </div>

        {s.enabled && (
          <div className="mt-4">
            {usable.points > 0 ? (
              <p className="rounded-xl bg-white/10 px-3 py-2 text-sm font-bold">💸 Use {fmtRupees(usable.rupees)} off your next order at checkout</p>
            ) : (
              <>
                <div className="h-2 rounded-full bg-white/15"><div className="h-2 rounded-full bg-brand-yellow" style={{ width: `${Math.min(100, (r.points / Math.max(1, s.min_redeem_points)) * 100)}%` }} /></div>
                <p className="mt-1.5 text-xs text-amber-100/80">{fmtPoints(toMin)} more points and you can start using them ({fmtPoints(s.min_redeem_points)} = {fmtRupees(pointsToRupees(s.min_redeem_points, s))} off)</p>
              </>
            )}
          </div>
        )}

        {s.enabled && s.free_item_enabled && r.freeItemName && (
          <div className="mt-4 border-t border-white/10 pt-4">
            {r.freeItems > 0 ? (
              <p className="flex items-center gap-2 rounded-xl bg-brand-green/90 px-3 py-2 text-sm font-bold text-white">
                <CupSoda size={16} /> {r.freeItems > 1 ? `${r.freeItems} free` : "A free"} {r.freeItemName} {r.freeItems > 1 ? "are" : "is"} waiting — claim at checkout
              </p>
            ) : (
              <>
                <p className="flex items-center justify-between text-xs font-bold text-amber-100/80">
                  <span className="flex items-center gap-1.5"><CupSoda size={14} /> Free {r.freeItemName}</span>
                  <span>{r.orderCount} / {s.free_item_orders} orders</span>
                </p>
                <div className="mt-1.5 h-2 rounded-full bg-white/15"><div className="h-2 rounded-full bg-green-400" style={{ width: `${stampPct}%` }} /></div>
              </>
            )}
          </div>
        )}

        {compact && <Link href="/account/rewards" className="mt-4 inline-block text-sm font-bold text-brand-yellow">See your rewards →</Link>}
      </div>
    </div>
  );
}
