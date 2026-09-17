import { format } from "date-fns";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr, cn } from "@/lib/utils";
import OrderStatusSelect from "@/components/admin/order-status-select";
import MarkPaidButton from "@/components/admin/mark-paid-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

const TABS = ["all","pending","confirmed","preparing","ready","on_the_way","delivered","cancelled"] as const;

export default async function AdminOrders({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  await requireRole(["super_admin"]);
  const status = TABS.includes((searchParams.status ?? "all") as never) ? searchParams.status : "all";
  const q = (searchParams.q ?? "").slice(0, 40);

  let query = supabaseAdmin
    .from("orders")
    .select("id, order_number, daily_number, status, type, total, payment_status, payment_method, created_at, notes, discount_amount, promo_codes:promo_code_id(code), profiles:customer_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status && status !== "all") query = query.eq("status", status);
  if (q) query = query.ilike("order_number", `%${q}%`);
  const { data: orders } = await query;

  // Count orders by status for the tab badges
  const { data: statusCounts } = await supabaseAdmin
    .from("orders")
    .select("status");
  
  const counts: Record<string, number> = {};
  (statusCounts ?? []).forEach((o: { status: string }) => {
    counts[o.status] = (counts[o.status] ?? 0) + 1;
  });
  counts["all"] = statusCounts?.length ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Order Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track, update, and manage all customer orders</p>
        </div>
        <form action="/super-admin/orders" className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search order #..." className="input !w-52 !py-2 text-sm" />
          <button type="submit" className="rounded-xl bg-violet-600 text-white px-4 py-2 text-sm font-bold">Search</button>
        </form>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-200">
        {TABS.map((t) => (
          <a key={t} href={`/super-admin/orders?status=${t}`}
             className={cn("rounded-full px-4 py-1.5 text-sm font-bold capitalize transition",
               status === t 
                 ? "bg-violet-600 text-white shadow-sm" 
                 : "bg-white text-slate-600 hover:bg-violet-50 border border-slate-200")}>
            {t.replace(/_/g, " ")}
            {counts[t] ? <span className="ml-1.5 text-[10px] opacity-70">({counts[t]})</span> : null}
          </a>
        ))}
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400 bg-slate-50/50">
              <th className="px-4 py-3.5 font-bold">Order #</th>
              <th className="px-4 py-3.5 font-bold">Customer</th>
              <th className="px-4 py-3.5 font-bold">Type</th>
              <th className="px-4 py-3.5 font-bold">Total</th>
              <th className="px-4 py-3.5 font-bold">Payment</th>
              <th className="px-4 py-3.5 font-bold">Placed</th>
              <th className="px-4 py-3.5 font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o: any) => {
              let customerName = o.profiles?.full_name;
              if (!customerName) {
                const match = o.notes?.match(/Name:\s*([^\n]+)/);
                customerName = match ? match[1] : o.notes?.includes("[Guest Checkout]") ? "Guest" : "Walk-in";
              }
              const isGuest = !o.profiles?.full_name;
              
              return (
                <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3.5">
                    {o.daily_number != null && o.type === "pickup" && (
                      <span className="mr-1.5 inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-extrabold text-violet-600">#{String(o.daily_number).padStart(2, "0")}</span>
                    )}
                    <span className="font-mono font-bold text-slate-900">{o.order_number}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-slate-900">{customerName}</div>
                    {isGuest && (
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">GUEST</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
                      o.type === "delivery" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                    )}>
                      {o.type === "delivery" ? "🛵 Delivery" : "🏪 Pickup"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-bold text-slate-900">{npr(Number(o.total))}</div>
                    {Number(o.discount_amount) > 0 && o.promo_codes?.code && (
                      <div className="text-[10px] text-brand-green bg-green-50 px-1.5 py-0.5 rounded-full inline-block mt-1 font-bold">
                        🎟️ {o.promo_codes.code} (-{npr(Number(o.discount_amount))})
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold uppercase text-slate-500">{o.payment_method ?? "—"}</span>
                      <MarkPaidButton orderId={o.id} total={Number(o.total)} paid={o.payment_status === "paid"} method={o.payment_method} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-500 text-xs">
                    <div>{format(new Date(o.created_at), "d MMM yyyy")}</div>
                    <div className="text-slate-400">{format(new Date(o.created_at), "h:mm a")}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <OrderStatusSelect orderId={o.id} status={o.status} />
                  </td>
                </tr>
              );
            })}
            {(orders ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <div className="text-3xl mb-2">📋</div>
                  <p className="font-bold text-slate-500">No orders found</p>
                  <p className="text-xs text-slate-400 mt-1">Try a different filter or search term</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
