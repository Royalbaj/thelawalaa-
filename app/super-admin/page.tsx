import { startOfDay } from "date-fns";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr } from "@/lib/utils";
import RealtimeFeed from "@/components/admin/realtime-feed";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireRole(["super_admin"]);
  const today = startOfDay(new Date()).toISOString();

  const [{ data: todays }, { count: activeDeliveries }, { count: pendingCount }, { count: totalCustomers }] = await Promise.all([
    supabaseAdmin.from("orders").select("total, payment_status, status").gte("created_at", today),
    supabaseAdmin.from("orders").select("id", { count: "exact", head: true })
      .eq("type", "delivery").in("status", ["assigned", "picked_up", "on_the_way"]),
    supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
  ]);

  const revenue = (todays ?? [])
    .filter((o) => o.payment_status === "paid" && o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.total), 0);

  const toCollect = (todays ?? [])
    .filter((o) => o.payment_status === "pending" && o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.total), 0);

  const cancelledToday = (todays ?? []).filter((o) => o.status === "cancelled").length;

  const { data: recent } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, status, type, total, payment_status, payment_method, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  const stats: { label: string; value: string; icon: string; color: string; highlight?: boolean }[] = [
    { label: "Today's Orders", value: String(todays?.length ?? 0), icon: "📦", color: "from-blue-50 to-indigo-50" },
    { label: "Revenue (Confirmed)", value: npr(revenue), icon: "💰", color: "from-green-50 to-emerald-50" },
    { label: "To Collect (Unpaid)", value: npr(toCollect), icon: "⏳", color: "from-amber-50 to-yellow-50", highlight: toCollect > 0 },
    { label: "Pending Orders", value: String(pendingCount ?? 0), icon: "🔔", color: "from-orange-50 to-red-50", highlight: (pendingCount ?? 0) > 0 },
    { label: "Active Deliveries", value: String(activeDeliveries ?? 0), icon: "🛵", color: "from-purple-50 to-pink-50" },
    { label: "Cancelled Today", value: String(cancelledToday), icon: "❌", color: "from-stone-50 to-stone-100" },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-2xl bg-gradient-to-br ${s.color} p-5 border ${s.highlight ? "border-amber-300 ring-2 ring-amber-200" : "border-stone-100"}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{s.label}</p>
              <span className="text-xl">{s.icon}</span>
            </div>
            <p className={`mt-2 font-display text-2xl font-bold ${s.highlight ? "text-brand-red" : "text-brand-brown"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/super-admin/orders" className="inline-flex items-center gap-2 rounded-xl bg-brand-orange text-white px-4 py-2.5 text-sm font-bold shadow-sm hover:brightness-110 transition">
          📋 View All Orders
        </Link>
        <Link href="/super-admin/menu" className="inline-flex items-center gap-2 rounded-xl bg-white text-brand-brown px-4 py-2.5 text-sm font-bold shadow-sm border border-stone-200 hover:bg-stone-50 transition">
          🍽️ Manage Menu
        </Link>
        <Link href="/super-admin/announcements" className="inline-flex items-center gap-2 rounded-xl bg-white text-brand-brown px-4 py-2.5 text-sm font-bold shadow-sm border border-stone-200 hover:bg-stone-50 transition">
          📢 Announcements
        </Link>
      </div>

      {/* Live Orders */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-brand-brown flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-green animate-pulse" />
            Live Orders
          </h2>
          <Link href="/super-admin/orders" className="text-sm font-bold text-brand-orange hover:underline">
            See all →
          </Link>
        </div>
        <RealtimeFeed initial={(recent ?? []) as never} />
      </div>
    </div>
  );
}
