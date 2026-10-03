import { format } from "date-fns";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr, cn } from "@/lib/utils";
import { STATUS_FILTERS } from "@/lib/order-status";
import OrderStatusSelect from "@/components/admin/order-status-select";
import MarkPaidButton from "@/components/admin/mark-paid-button";
import { ItemsSummary, OrderDetails } from "@/components/admin/order-details";

export const dynamic = "force-dynamic";

const TABS = [{ key: "all", label: "All", statuses: [] as string[] }, ...STATUS_FILTERS];

export default async function AdminOrders(props: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireRole(["super_admin"]);
  const searchParams = await props.searchParams;
  const tab = TABS.find((t) => t.key === searchParams.status) ?? TABS[0];
  const status = tab.key;
  const q = (searchParams.q ?? "").slice(0, 40);

  let query = supabaseAdmin
    .from("orders")
    .select("id, order_number, daily_number, status, type, subtotal, delivery_fee, total, payment_status, payment_method, created_at, notes, discount_amount, discount_label, points_discount, delivery_address, delivery_lat, delivery_lng, promo_codes:promo_code_id(code), profiles:customer_id(full_name), items:order_items(product_name, quantity, product_price, line_total)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (tab.statuses.length) query = query.in("status", tab.statuses);
  if (q) query = query.ilike("order_number", `%${q}%`);
  const { data: orders } = await query;

  // Count orders per tab for the badges
  const { data: statusCounts } = await supabaseAdmin
    .from("orders")
    .select("status");

  const rows = (orders ?? []).map((o: any) => {
    let customerName = o.profiles?.full_name;
    if (!customerName) {
      const match = o.notes?.match(/Name:\s*([^\n]+)/);
      customerName = match ? match[1] : o.notes?.includes("[Guest Checkout]") ? "Guest" : "Walk-in";
    }
    return { o, customerName: customerName as string, isGuest: !o.profiles?.full_name };
  });

  const counts: Record<string, number> = { all: statusCounts?.length ?? 0 };
  for (const t of STATUS_FILTERS) {
    counts[t.key] = (statusCounts ?? []).filter((o: { status: string }) => t.statuses.includes(o.status)).length;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-brown">Order Management</h1>
          <p className="text-sm text-stone-500 mt-0.5">Track, update, and manage all customer orders</p>
        </div>
        <form action="/admin/orders" className="flex w-full gap-2 sm:w-auto">
          <input name="q" defaultValue={q} placeholder="Search order #..." className="input !py-2 text-base sm:!w-52 sm:text-sm" />
          <button type="submit" className="rounded-xl bg-brand-orange text-white px-4 py-2 text-sm font-bold">Search</button>
        </form>
      </div>

      {/* Status Tabs */}
      <div className="-mx-3 flex items-center gap-2 overflow-x-auto border-b border-stone-200 px-3 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <a key={t.key} href={`/admin/orders?status=${t.key}`}
             className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition",
               status === t.key
                 ? "bg-brand-orange text-white shadow-sm"
                 : "bg-white text-stone-600 hover:bg-orange-50 border border-stone-200")}>
            {t.label}
            {counts[t.key] ? <span className="ml-1.5 text-[10px] opacity-70">({counts[t.key]})</span> : null}
          </a>
        ))}
      </div>

      {/* Phones: one card per order */}
      <div className="space-y-2.5 md:hidden">
        {rows.map(({ o, customerName, isGuest }) => (
          <div key={o.id} className="rounded-2xl border border-stone-100 bg-white p-3.5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5">
                  {o.daily_number != null && o.type === "pickup" && (
                    <span className="rounded-full bg-brand-orange/10 px-2 py-0.5 text-xs font-extrabold text-brand-orange">#{String(o.daily_number).padStart(2, "0")}</span>
                  )}
                  <span className="font-mono text-sm font-bold text-brand-brown">{o.order_number}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-stone-500">
                  {customerName}{isGuest && customerName !== "Guest" ? " (guest)" : ""} · {o.type === "delivery" ? "🛵 Delivery" : o.type === "dine_in" ? "🍽 Dine-in" : "🏪 Pickup"} · {format(new Date(o.created_at), "d MMM, h:mm a")}
                </p>
              </div>
              <p className="shrink-0 font-display text-lg font-bold text-brand-brown">{npr(Number(o.total))}</p>
            </div>
            <div className="mt-1.5"><ItemsSummary items={o.items ?? []} /></div>
            {Number(o.discount_amount) > 0 && o.promo_codes?.code && (
              <p className="mt-1 inline-block rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-brand-green">🎟️ {o.promo_codes.code} (−{npr(Number(o.discount_amount))})</p>
            )}
            <OrderDetails o={{ ...o, items: o.items ?? [] }} />
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <MarkPaidButton orderId={o.id} total={Number(o.total)} paid={o.payment_status === "paid"} method={o.payment_method} />
              <span className="text-[11px] font-bold uppercase text-stone-400">{o.payment_method ?? "—"}</span>
              <span className="ml-auto"><OrderStatusSelect orderId={o.id} status={o.status} type={o.type} /></span>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="rounded-2xl bg-white px-4 py-12 text-center">
            <div className="mb-2 text-3xl">📋</div>
            <p className="font-bold text-stone-500">No orders found</p>
            <p className="mt-1 text-xs text-stone-400">Try a different filter or search term</p>
          </div>
        )}
      </div>

      {/* Orders Table (tablets and up) */}
      <div className="hidden rounded-2xl bg-white shadow-sm border border-stone-100 overflow-x-auto md:block">
        <table className="w-full text-sm [&_td]:align-top">
          <thead>
            <tr className="border-b border-stone-100 text-left text-xs uppercase text-stone-400 bg-stone-50/50">
              <th className="px-4 py-3.5 font-bold">Order #</th>
              <th className="px-4 py-3.5 font-bold">Customer</th>
              <th className="px-4 py-3.5 font-bold">Items</th>
              <th className="px-4 py-3.5 font-bold">Type</th>
              <th className="px-4 py-3.5 font-bold">Total</th>
              <th className="px-4 py-3.5 font-bold">Payment</th>
              <th className="px-4 py-3.5 font-bold">Placed</th>
              <th className="px-4 py-3.5 font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ o, customerName, isGuest }) => {
              return (
                <tr key={o.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition-colors">
                  <td className="px-4 py-3.5">
                    {o.daily_number != null && o.type === "pickup" && (
                      <span className="mr-1.5 inline-flex items-center rounded-full bg-brand-orange/10 px-2 py-0.5 text-xs font-extrabold text-brand-orange">#{String(o.daily_number).padStart(2, "0")}</span>
                    )}
                    <span className="font-mono font-bold text-brand-brown">{o.order_number}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-brand-brown">{customerName}</div>
                    {isGuest && (
                      <span className="text-[10px] font-bold text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">GUEST</span>
                    )}
                  </td>
                  <td className="min-w-[220px] max-w-[320px] px-4 py-3.5">
                    <ItemsSummary items={o.items ?? []} />
                    <OrderDetails o={{ ...o, items: o.items ?? [] }} />
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
                    <div className="font-bold text-brand-brown">{npr(Number(o.total))}</div>
                    {Number(o.discount_amount) > 0 && o.promo_codes?.code && (
                      <div className="text-[10px] text-brand-green bg-green-50 px-1.5 py-0.5 rounded-full inline-block mt-1 font-bold">
                        🎟️ {o.promo_codes.code} (-{npr(Number(o.discount_amount))})
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold uppercase text-stone-500">{o.payment_method ?? "—"}</span>
                      <MarkPaidButton orderId={o.id} total={Number(o.total)} paid={o.payment_status === "paid"} method={o.payment_method} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-stone-500 text-xs">
                    <div>{format(new Date(o.created_at), "d MMM yyyy")}</div>
                    <div className="text-stone-400">{format(new Date(o.created_at), "h:mm a")}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <OrderStatusSelect orderId={o.id} status={o.status} type={o.type} />
                  </td>
                </tr>
              );
            })}
            {(orders ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center">
                  <div className="text-3xl mb-2">📋</div>
                  <p className="font-bold text-stone-500">No orders found</p>
                  <p className="text-xs text-stone-400 mt-1">Try a different filter or search term</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
