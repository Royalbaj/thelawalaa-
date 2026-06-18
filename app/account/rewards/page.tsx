import { getVerifiedUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RewardsPage() {
  const { user } = await getVerifiedUser();
  if (!user) return null;

  const supabase = createClient();
  const [{ data: loyalty }, { data: transactions }] = await Promise.all([
    supabase.from("loyalty_points").select("*").eq("customer_id", user.id).maybeSingle(),
    supabase.from("loyalty_transactions").select("*").eq("customer_id", user.id).order("created_at", { ascending: false }).limit(20),
  ]);

  const tiers = [
    { name: "Bronze", min: 0, color: "from-amber-600 to-yellow-500", icon: "🥉" },
    { name: "Silver", min: 500, color: "from-stone-400 to-stone-300", icon: "🥈" },
    { name: "Gold", min: 2000, color: "from-amber-400 to-yellow-300", icon: "🥇" },
    { name: "Platinum", min: 5000, color: "from-purple-500 to-pink-400", icon: "💎" },
  ];

  const currentTier = tiers.find((t) => t.name.toLowerCase() === (loyalty?.tier ?? "bronze")) ?? tiers[0];
  const nextTier = tiers[tiers.indexOf(currentTier) + 1];
  const progress = nextTier ? Math.min(100, ((loyalty?.total_earned ?? 0) / nextTier.min) * 100) : 100;

  const reasonLabels: Record<string, string> = {
    signup: "🎉 Welcome Bonus",
    order_reward: "🛒 Order Reward",
    redemption: "🎁 Redeemed",
    bonus: "⭐ Special Bonus",
  };

  return (
    <div className="px-4 py-4 pb-24 space-y-4">
      <h1 className="font-display text-xl font-bold text-brand-brown">Rewards & Loyalty</h1>

      {/* Points Card */}
      <div className={`rounded-2xl bg-gradient-to-r ${currentTier.color} p-5 text-white relative overflow-hidden`}>
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full" />
        <div className="absolute -bottom-5 -left-5 w-20 h-20 bg-white/5 rounded-full" />
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">{currentTier.icon} {currentTier.name} Member</p>
        <p className="text-4xl font-bold mt-2">{loyalty?.points ?? 0}</p>
        <p className="text-sm text-white/70">Available Points</p>
        
        {nextTier && (
          <div className="mt-4">
            <div className="flex justify-between text-[10px] text-white/60 mb-1">
              <span>{currentTier.name}</span>
              <span>{nextTier.name} ({nextTier.min} pts)</span>
            </div>
            <div className="h-2 rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white/80 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* How It Works */}
      <div className="rounded-2xl bg-white border border-stone-100 p-4">
        <h3 className="font-bold text-sm text-brand-brown mb-3">How Rewards Work</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl mb-1">🛒</div>
            <p className="text-[10px] font-bold text-stone-600">Order food</p>
            <p className="text-[10px] text-stone-400">Earn 1pt per Rs 10</p>
          </div>
          <div>
            <div className="text-2xl mb-1">📈</div>
            <p className="text-[10px] font-bold text-stone-600">Level up</p>
            <p className="text-[10px] text-stone-400">Unlock better rewards</p>
          </div>
          <div>
            <div className="text-2xl mb-1">🎁</div>
            <p className="text-[10px] font-bold text-stone-600">Redeem</p>
            <p className="text-[10px] text-stone-400">Get discounts & free items</p>
          </div>
        </div>
      </div>

      {/* Points History */}
      <div>
        <h3 className="font-bold text-sm text-brand-brown mb-2">Points History</h3>
        {(transactions ?? []).length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center border border-stone-100">
            <p className="text-3xl mb-2">📊</p>
            <p className="text-sm text-stone-400">No transactions yet</p>
            <Link href="/order" className="inline-block mt-2 text-xs font-bold text-brand-orange">Order to earn points →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {(transactions ?? []).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl bg-white p-3 border border-stone-100">
                <div>
                  <p className="text-xs font-bold text-brand-brown">{reasonLabels[t.reason] ?? t.reason}</p>
                  <p className="text-[10px] text-stone-400">{new Date(t.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-sm font-bold ${t.points_change > 0 ? "text-green-600" : "text-red-500"}`}>
                  {t.points_change > 0 ? "+" : ""}{t.points_change}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
