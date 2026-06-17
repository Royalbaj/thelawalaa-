import { startOfDay } from "date-fns";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr } from "@/lib/utils";
import RealtimeFeed from "@/components/admin/realtime-feed";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireRole(["admin"]);
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

  // Money the team still has to physically collect (cash/QR not yet confirmed)
  const toCollect = (todays ?? [])
    .filter((o) => o.payment_status === "pending" && o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.total), 0);

  const { data: recent } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, status, type, total, payment_status, payment_method, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  const stats: { label: string; value: string; highlight?: boolean }[] = [
    { label: "Today's orders", value: String(todays?.length ?? 0) },
    { label: "Confirmed revenue", value: npr(revenue) },
    { label: "To collect (unpaid)", value: npr(toCollect), highlight: toCollect > 0 },
    { label: "Active deliveries", value: String(activeDeliveries ?? 0) },
    { label: "Pending orders", value: String(pendingCount ?? 0) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className={s.highlight ? "card p-5 ring-2 ring-brand-yellow" : "card p-5"}>
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{s.label}</p>
            <p className={`mt-1 font-display text-2xl font-bold ${s.highlight ? "text-brand-red" : "text-brand-brown"}`}>{s.value}</p>
          </div>
        ))}
      </div>
      <div>
        <h2 className="mb-3 font-display text-lg font-bold text-brand-brown">Live orders</h2>
        <RealtimeFeed initial={(recent ?? []) as never} />
      </div>
    </div>
  );
}
