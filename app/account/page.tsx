import { getVerifiedUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { npr } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AccountHome() {
  const { user, profile } = await getVerifiedUser();
  if (!user || !profile) return null;

  // Fetch offers, recent orders, loyalty points
  const supabase = createClient();
  const [{ data: offers }, { data: recentOrders }, { data: loyalty }, { data: favorites }] = await Promise.all([
    supabase.from("offers").select("*").order("sort_order").limit(6),
    supabase.from("orders").select("id, order_number, status, total, type, created_at").order("created_at", { ascending: false }).limit(3),
    supabase.from("loyalty_points").select("*").eq("customer_id", user.id).maybeSingle(),
    supabase.from("customer_favorites").select("product_id, products(name, price, image_url)").eq("customer_id", user.id).limit(4),
  ]);

  const tierColors: Record<string, string> = {
    bronze: "from-amber-600 to-yellow-500",
    silver: "from-stone-400 to-stone-300",
    gold: "from-amber-400 to-yellow-300",
    platinum: "from-purple-500 to-pink-400",
  };

  return (
    <div className="pb-24 space-y-4">
      {/* Welcome Header */}
      <div className="bg-brand-dark text-white px-4 pb-6 pt-2 -mt-0 rounded-b-3xl">
        <p className="text-lg font-bold">Hey, {profile.full_name.split(" ")[0]}! 👋</p>
        <p className="text-xs text-white/50 mt-0.5">What are you craving today?</p>

        {/* Loyalty Card */}
        <div className={`mt-4 rounded-2xl bg-gradient-to-r ${tierColors[loyalty?.tier ?? "bronze"]} p-4 relative overflow-hidden`}>
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <p className="text-xs font-bold text-white/80 uppercase tracking-wider">{loyalty?.tier ?? "Bronze"} Member</p>
          <p className="text-3xl font-bold mt-1">{loyalty?.points ?? 0} <span className="text-sm font-normal">points</span></p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[10px] text-white/60">{loyalty?.total_earned ?? 0} earned · {loyalty?.total_spent ?? 0} spent</p>
            <Link href="/account/rewards" className="text-[10px] font-bold bg-white/20 px-2.5 py-1 rounded-full">
              View Rewards →
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 grid grid-cols-4 gap-2">
        {[
          { href: "/order", icon: "🛒", label: "Order Now", bg: "bg-orange-50" },
          { href: "/account/orders", icon: "📦", label: "My Orders", bg: "bg-blue-50" },
          { href: "/account/rewards", icon: "🎁", label: "Rewards", bg: "bg-purple-50" },
          { href: "/account/profile", icon: "⚙️", label: "Settings", bg: "bg-stone-100" },
        ].map((a) => (
          <Link key={a.href} href={a.href} className={`${a.bg} rounded-2xl p-3 text-center hover:shadow-sm transition`}>
            <p className="text-2xl">{a.icon}</p>
            <p className="text-[10px] font-bold text-stone-600 mt-1">{a.label}</p>
          </Link>
        ))}
      </div>

      {/* Offers & Deals Carousel */}
      {(offers ?? []).length > 0 && (
        <div className="px-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-lg font-bold text-brand-brown">🔥 Deals For You</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
            {(offers ?? []).map((offer: any) => (
              <div key={offer.id} className="snap-start shrink-0 w-64 rounded-2xl overflow-hidden bg-white shadow-sm border border-stone-100">
                {offer.image_url ? (
                  <img src={offer.image_url} alt={offer.title} className="w-full h-28 object-cover" />
                ) : (
                  <div className="w-full h-28 bg-gradient-to-br from-brand-orange to-amber-500 flex items-center justify-center">
                    <span className="text-4xl">🎉</span>
                  </div>
                )}
                <div className="p-3">
                  <p className="font-bold text-sm text-brand-brown">{offer.title}</p>
                  <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{offer.description}</p>
                  {offer.discount_label && (
                    <span className="inline-block mt-2 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {offer.discount_label}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display text-lg font-bold text-brand-brown">📦 Recent Orders</h2>
          <Link href="/account/orders" className="text-xs font-bold text-brand-orange">See all →</Link>
        </div>
        {(recentOrders ?? []).length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center border border-stone-100">
            <p className="text-3xl mb-2">🍜</p>
            <p className="text-sm font-bold text-stone-500">No orders yet</p>
            <Link href="/order" className="inline-block mt-3 btn-primary text-sm">Start Ordering →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {(recentOrders ?? []).map((o: any) => (
              <Link key={o.id} href={`/track/${o.id}`} className="flex items-center justify-between rounded-2xl bg-white p-4 border border-stone-100 hover:shadow-sm transition">
                <div>
                  <p className="font-mono text-xs font-bold text-brand-brown">{o.order_number}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5 capitalize">{o.type} · {o.status.replace(/_/g, " ")}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-brand-orange">{npr(Number(o.total))}</p>
                  <p className="text-[10px] text-stone-400">{new Date(o.created_at).toLocaleDateString()}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Reorder Favorites */}
      {(favorites ?? []).length > 0 && (
        <div className="px-4">
          <h2 className="font-display text-lg font-bold text-brand-brown mb-2">❤️ Your Favorites</h2>
          <div className="grid grid-cols-2 gap-2">
            {(favorites ?? []).map((f: any) => (
              <div key={f.product_id} className="rounded-2xl bg-white p-3 border border-stone-100">
                {f.products?.image_url && (
                  <img src={f.products.image_url} alt={f.products?.name} className="w-full h-20 object-cover rounded-xl mb-2" />
                )}
                <p className="text-xs font-bold text-brand-brown truncate">{f.products?.name}</p>
                <p className="text-xs font-bold text-brand-orange">{npr(Number(f.products?.price ?? 0))}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
