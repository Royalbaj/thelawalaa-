import Link from "next/link";
import { Package, Bike, Store, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { getVerifiedUser, createClient } from "@/lib/supabase/server";
import { npr, STATUS_COLORS } from "@/lib/utils";
import { orderStatusLabel } from "@/lib/order-status";
import { fmtPoints } from "@/lib/rewards";
import ReorderButton from "@/components/account/reorder-button";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

export default async function MyOrders() {
  const { user } = await getVerifiedUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, daily_number, status, total, type, payment_status, payment_method, created_at, points_earned, points_redeemed, free_item_redeemed, items:order_items(product_name, quantity)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-4 pb-24 sm:pb-8">
      <h1 className="font-display text-2xl font-extrabold text-brand-brown">My orders</h1>
      {(orders ?? []).length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-stone-100">
          <Package size={34} className="mx-auto mb-2 text-stone-300" />
          <p className="font-bold text-stone-600">No orders yet</p>
          <Link href="/order" className="btn-primary mt-4 !py-2.5 text-sm">Place your first order</Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(orders ?? []).map((o) => {
            const items = o.items as { product_name: string; quantity: number }[];
            return (
              <div key={o.id} className="flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-brand-brown">{o.order_number}</p>
                    <p className="text-xs text-stone-500">{when(o.created_at)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_COLORS[o.status] ?? "bg-stone-100 text-stone-600"}`}>{orderStatusLabel(o.status, o.type)}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-stone-600">{items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ")}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold">
                  <span className="flex items-center gap-1 text-stone-500">{o.type === "delivery" ? <Bike size={12} /> : <Store size={12} />} {o.type === "delivery" ? "Delivery" : "Pickup"}</span>
                  <span className={`flex items-center gap-1 ${o.payment_status === "paid" ? "text-green-700" : "text-amber-600"}`}>
                    {o.payment_status === "paid" ? <CheckCircle2 size={12} /> : <Clock size={12} />} {o.payment_status === "paid" ? "Paid" : "Pay on arrival"}
                  </span>
                  {o.points_earned > 0 && <span className="flex items-center gap-1 text-amber-600"><Sparkles size={12} /> +{fmtPoints(o.points_earned)} pts</span>}
                  {o.points_redeemed > 0 && <span className="text-stone-500">−{fmtPoints(o.points_redeemed)} pts used</span>}
                  {o.free_item_redeemed && <span className="text-green-700">Free drink claimed</span>}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
                  <p className="font-display text-lg font-bold text-brand-brown">{npr(Number(o.total))}</p>
                  <div className="flex items-center gap-2">
                    <Link href={`/track/${o.id}`} className="rounded-full px-3.5 py-1.5 text-xs font-bold text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50">Track</Link>
                    <ReorderButton orderId={o.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
