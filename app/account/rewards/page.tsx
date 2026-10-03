import Link from "next/link";
import { Star, Wallet, CupSoda, ShoppingBag } from "lucide-react";
import { getVerifiedUser, createClient } from "@/lib/supabase/server";
import { getCustomerRewards } from "@/lib/customer";
import { describeRewards, fmtPoints } from "@/lib/rewards";
import RewardsCard from "@/components/account/rewards-card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  signup: "Welcome bonus", order_reward: "Earned on an order", redemption: "Used at checkout", refund: "Returned (order cancelled)",
  reversal: "Taken back (order not completed)", free_item_earned: "Free drink unlocked", free_item_used: "Free drink claimed",
  bonus: "Bonus", adjustment: "Adjustment",
};
const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "short", year: "numeric" });

export default async function RewardsPage() {
  const { user } = await getVerifiedUser();
  if (!user) return null;
  const supabase = await createClient();
  const [r, { data: history }] = await Promise.all([
    getCustomerRewards(user.id),
    supabase.from("loyalty_transactions").select("id, points_change, reason, created_at, orders(order_number)")
      .eq("customer_id", user.id).order("created_at", { ascending: false }).limit(40),
  ]);
  const rules = describeRewards(r.settings, r.freeItemName);
  const stamps = r.settings.free_item_orders;

  return (
    <div className="space-y-6 pb-4">
      <h1 className="font-display text-2xl font-extrabold text-brand-brown">Rewards</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <RewardsCard r={r} />
        {r.settings.free_item_enabled && r.freeItemName && (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-brand-brown"><CupSoda size={20} className="text-brand-green" /> Free {r.freeItemName} card</h2>
            <p className="text-sm text-stone-500">Every paid order you place online while signed in adds a stamp.</p>
            <div className="mt-4 grid grid-cols-10 gap-1.5 sm:gap-2" aria-label={`${r.orderCount} of ${stamps} stamps`}>
              {Array.from({ length: stamps }, (_, i) => (
                <span key={i} className={cn("flex aspect-square items-center justify-center rounded-full text-[10px] font-extrabold",
                  i < r.orderCount ? "bg-brand-green text-white" : "bg-stone-100 text-stone-300")}>{i + 1}</span>
              ))}
            </div>
            <p className="mt-3 text-sm font-bold text-brand-brown">
              {r.freeItems > 0 ? `🎉 ${r.freeItems} free ${r.freeItemName} ready — tick it at checkout` : `${stamps - r.orderCount} more ${stamps - r.orderCount === 1 ? "order" : "orders"} to go`}
            </p>
          </section>
        )}
      </div>

      {r.settings.enabled && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-brand-brown">How it works</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: Star, title: "Earn", body: rules.earn, tint: "bg-amber-50 text-amber-600" },
              { icon: Wallet, title: "Spend", body: rules.value, tint: "bg-orange-50 text-brand-orange" },
              ...(rules.free ? [{ icon: CupSoda, title: "Free drink", body: rules.free, tint: "bg-green-50 text-brand-green" }] : []),
            ].map((c) => (
              <div key={c.title} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.tint}`}><c.icon size={20} /></span>
                <p className="mt-3 font-bold text-brand-brown">{c.title}</p>
                <p className="mt-1 text-sm text-stone-600">{c.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-stone-400">Points are added when an order is paid, and only for orders placed online while you&apos;re signed in. Cancelled orders give back any points they used.</p>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-lg font-bold text-brand-brown">History</h2>
        <div className="divide-y divide-stone-100 rounded-2xl bg-white shadow-sm ring-1 ring-stone-100">
          {(history ?? []).map((h) => {
            const order = (h.orders as unknown as { order_number: string } | null)?.order_number;
            return (
              <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-stone-800">{REASONS[h.reason] ?? h.reason}</p>
                  <p className="text-xs text-stone-400">{when(h.created_at)}{order ? ` · ${order}` : ""}</p>
                </div>
                {h.points_change !== 0 && (
                  <span className={cn("shrink-0 font-bold tabular-nums", h.points_change > 0 ? "text-green-700" : "text-stone-700")}>
                    {h.points_change > 0 ? "+" : "−"}{fmtPoints(Math.abs(h.points_change))}
                  </span>
                )}
              </div>
            );
          })}
          {(history ?? []).length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-stone-500">
              Nothing yet — <Link href="/order" className="font-bold text-brand-orange">place an order</Link> to start earning. <ShoppingBag size={14} className="inline" />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
