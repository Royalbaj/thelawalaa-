import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, getRewardSettings } from "@/lib/supabase/admin";
import { fmtPoints, fmtRupees } from "@/lib/rewards";
import RewardSettingsForm from "@/components/admin/reward-settings-form";

export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  signup: "Welcome bonus", order_reward: "Earned", redemption: "Used at checkout", refund: "Returned (cancelled)",
  reversal: "Taken back", free_item_earned: "Free item unlocked", free_item_used: "Free item claimed",
};
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

export default async function RewardsAdminPage() {
  await requireRole(["super_admin"]);
  const [settings, { data: products }, { data: balances }, { data: activity }] = await Promise.all([
    getRewardSettings(),
    supabaseAdmin.from("products").select("id, name").eq("pos_only", false).order("name"),
    supabaseAdmin.from("loyalty_points").select("points, free_items"),
    supabaseAdmin.from("loyalty_transactions").select("id, points_change, reason, created_at, profiles(full_name), orders(order_number)")
      .order("created_at", { ascending: false }).limit(25),
  ]);
  const outstanding = (balances ?? []).reduce((s, b) => s + (b.points ?? 0), 0);
  const ready = (balances ?? []).filter((b) => b.points >= settings.min_redeem_points).length;
  const freeWaiting = (balances ?? []).reduce((s, b) => s + (b.free_items ?? 0), 0);
  const tiles = [
    { label: "Members", value: fmtPoints((balances ?? []).length) },
    { label: "Points out there", value: fmtPoints(outstanding), sub: `worth ${fmtRupees(outstanding / settings.points_per_rupee)}` },
    { label: "Can use points now", value: fmtPoints(ready), sub: `have ${fmtPoints(settings.min_redeem_points)}+` },
    { label: "Free items waiting", value: fmtPoints(freeWaiting) },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="card p-5 sm:p-6">
        <h2 className="mb-1 font-display text-lg font-bold text-brand-brown">Reward rules</h2>
        <p className="mb-5 text-xs text-stone-500">Customers see these on their Rewards page, at checkout and in their welcome email. Changes apply from the next paid order.</p>
        <RewardSettingsForm initial={settings} products={products ?? []} />
      </section>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="card p-4">
              <p className="text-xs font-bold text-stone-500">{t.label}</p>
              <p className="mt-1 font-display text-2xl font-bold text-stone-900">{t.value}</p>
              {t.sub && <p className="text-xs text-stone-400">{t.sub}</p>}
            </div>
          ))}
        </div>
        <section className="card overflow-hidden">
          <h2 className="px-5 pt-5 font-display text-lg font-bold text-brand-brown">Recent activity</h2>
          <div className="mt-2 divide-y divide-stone-100">
            {(activity ?? []).map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="min-w-0">
                  <b className="text-stone-800">{(a.profiles as unknown as { full_name: string } | null)?.full_name ?? "Customer"}</b>
                  <span className="text-stone-500"> · {REASONS[a.reason] ?? a.reason}{(a.orders as unknown as { order_number: string } | null)?.order_number ? ` · ${(a.orders as unknown as { order_number: string }).order_number}` : ""}</span>
                  <span className="block text-xs text-stone-400">{when(a.created_at)}</span>
                </span>
                {a.points_change !== 0 && <span className={a.points_change > 0 ? "font-bold text-green-700" : "font-bold text-stone-700"}>{a.points_change > 0 ? "+" : "−"}{fmtPoints(Math.abs(a.points_change))}</span>}
              </div>
            ))}
            {(activity ?? []).length === 0 && <p className="px-5 py-8 text-center text-sm text-stone-400">No reward activity yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
