import { startOfDay } from "date-fns";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr } from "@/lib/utils";
import RealtimeFeed from "@/components/admin/realtime-feed";
import Link from "next/link";
import { Package, Wallet, Clock, Bell, Bike, XCircle, ClipboardList, UtensilsCrossed, Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireRole(["super_admin"]);
  const today = startOfDay(new Date()).toISOString();

  const [{ data: todays }, { count: activeDeliveries }, { count: pendingCount }] = await Promise.all([
    supabaseAdmin.from("orders").select("total, payment_status, status").gte("created_at", today),
    supabaseAdmin.from("orders").select("id", { count: "exact", head: true })
      .eq("type", "delivery").in("status", ["assigned", "picked_up", "on_the_way"]),
    supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
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

  const stats: { label: string; value: string; icon: typeof Package; iconBg: string; highlight?: boolean }[] = [
    { label: "Today's Orders", value: String(todays?.length ?? 0), icon: Package, iconBg: "bg-indigo-100 text-indigo-600" },
    { label: "Revenue (Confirmed)", value: npr(revenue), icon: Wallet, iconBg: "bg-emerald-100 text-emerald-600" },
    { label: "To Collect (Unpaid)", value: npr(toCollect), icon: Clock, iconBg: "bg-amber-100 text-amber-600", highlight: toCollect > 0 },
    { label: "Pending Orders", value: String(pendingCount ?? 0), icon: Bell, iconBg: "bg-rose-100 text-rose-600", highlight: (pendingCount ?? 0) > 0 },
    { label: "Active Deliveries", value: String(activeDeliveries ?? 0), icon: Bike, iconBg: "bg-violet-100 text-violet-600" },
    { label: "Cancelled Today", value: String(cancelledToday), icon: XCircle, iconBg: "bg-slate-200 text-slate-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-2xl bg-white p-5 shadow-sm border transition hover:shadow-md ${s.highlight ? "border-amber-300 ring-2 ring-amber-200/60" : "border-slate-200"}`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.iconBg}`}>
              <s.icon size={19} strokeWidth={2.3} />
            </div>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/super-admin/orders" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 py-2.5 text-sm font-bold shadow-lg shadow-violet-900/20 hover:brightness-110 transition">
          <ClipboardList size={16} /> View All Orders
        </Link>
        <Link href="/super-admin/menu" className="inline-flex items-center gap-2 rounded-xl bg-white text-slate-700 px-4 py-2.5 text-sm font-bold shadow-sm border border-slate-200 hover:bg-slate-50 transition">
          <UtensilsCrossed size={16} /> Manage Menu
        </Link>
        <Link href="/super-admin/announcements" className="inline-flex items-center gap-2 rounded-xl bg-white text-slate-700 px-4 py-2.5 text-sm font-bold shadow-sm border border-slate-200 hover:bg-slate-50 transition">
          <Megaphone size={16} /> Announcements
        </Link>
      </div>

      {/* Live Orders */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Orders
          </h2>
          <Link href="/super-admin/orders" className="text-sm font-bold text-violet-600 hover:underline">
            See all →
          </Link>
        </div>
        <RealtimeFeed initial={(recent ?? []) as never} />
      </div>
    </div>
  );
}
