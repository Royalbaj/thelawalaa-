import { getVerifiedUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { npr } from "@/lib/utils";
import Link from "next/link";
import { Package, Bike, Store, CheckCircle2, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MyOrders() {
  const { user } = await getVerifiedUser();
  if (!user) return null;

  const supabase = createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, total, type, payment_status, payment_method, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  const statusColors: Record<string, string> = {
    pending: "text-amber-600 bg-amber-50",
    confirmed: "text-blue-600 bg-blue-50",
    preparing: "text-purple-600 bg-purple-50",
    ready: "text-green-600 bg-green-50",
    assigned: "text-cyan-600 bg-cyan-50",
    picked_up: "text-indigo-600 bg-indigo-50",
    on_the_way: "text-violet-600 bg-violet-50",
    delivered: "text-emerald-600 bg-emerald-50",
    cancelled: "text-red-600 bg-red-50",
  };

  return (
    <div className="px-4 py-4 pb-24 space-y-3">
      <h1 className="font-display text-xl font-bold text-brand-brown">My Orders</h1>

      {(orders ?? []).length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center border border-stone-100">
          <Package size={32} className="mx-auto mb-2 text-stone-300" />
          <p className="font-bold text-stone-500">No orders yet</p>
          <Link href="/order" className="inline-block mt-3 btn-primary text-sm">Place Your First Order →</Link>
        </div>
      ) : (
        (orders ?? []).map((o: any) => (
          <Link key={o.id} href={`/track/${o.id}`} className="block rounded-2xl bg-white border border-stone-100 p-4 hover:shadow-sm transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-sm font-bold text-brand-brown">{o.order_number}</p>
                <p className="text-[10px] text-stone-400 mt-0.5">{new Date(o.created_at).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${statusColors[o.status] ?? "bg-stone-100 text-stone-600"}`}>
                {o.status.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-50">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-[10px] font-bold text-stone-400">
                  {o.type === "delivery" ? <Bike size={12} /> : <Store size={12} />} {o.type === "delivery" ? "Delivery" : "Pickup"}
                </span>
                <span className={`flex items-center gap-1 text-[10px] font-bold ${o.payment_status === "paid" ? "text-green-600" : "text-amber-600"}`}>
                  {o.payment_status === "paid" ? <CheckCircle2 size={12} /> : <Clock size={12} />} {o.payment_status === "paid" ? "Paid" : "Pending"}
                </span>
              </div>
              <p className="font-bold text-brand-orange">{npr(Number(o.total))}</p>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
