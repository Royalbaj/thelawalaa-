import { format } from "date-fns";
import Link from "next/link";
import { requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = ["all", "pending", "confirmed", "preparing", "ready", "on_the_way", "delivered", "cancelled"] as const;

// Read-only — accountants and admins can see every order here, but
// nothing on this page can change one. Status/payment changes stay in
// the main admin console, where every write is audited.
export default async function OrdersPage({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  await requireAuth();
  const status = TABS.includes((searchParams.status ?? "all") as never) ? searchParams.status : "all";
  const q = (searchParams.q ?? "").slice(0, 40);

  let query = supabaseAdmin
    .from("orders")
    .select("id, order_number, daily_number, status, type, total, payment_status, payment_method, created_at, customer:customer_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && status !== "all") query = query.eq("status", status);
  if (q) query = query.ilike("order_number", `%${q}%`);
  const { data: orders } = await query;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-brown">Orders</h1>
          <p className="mt-0.5 text-sm text-stone-500">Every order, read-only — full history, no delete or edit here.</p>
        </div>
        <form action="/orders" className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search order #…" className="input !w-52 !py-2 text-sm" />
          <button type="submit" className="rounded-xl bg-brand-orange px-4 py-2 text-sm font-bold text-white">Search</button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 pb-2">
        {TABS.map((t) => (
          <a
            key={t}
            href={`/orders?status=${t}`}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-bold capitalize transition",
              status === t ? "bg-brand-orange text-white shadow-sm" : "border border-stone-200 bg-white text-stone-600 hover:bg-orange-50"
            )}
          >
            {t.replace(/_/g, " ")}
          </a>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50/50 text-left text-xs uppercase text-stone-400">
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
            {(orders ?? []).map((o: any) => (
              <tr key={o.id} className="border-b border-stone-50 transition-colors last:border-0 hover:bg-stone-50/50">
                <td className="px-4 py-3.5">
                  <Link href={`/orders/${o.id}`} className="font-mono font-bold text-brand-orange hover:underline">
                    {o.order_number}
                  </Link>
                </td>
                <td className="px-4 py-3.5 font-medium text-brand-brown">{o.customer?.full_name ?? "Guest"}</td>
                <td className="px-4 py-3.5 capitalize text-stone-600">{o.type}</td>
                <td className="px-4 py-3.5 font-bold text-brand-brown">{npr(Number(o.total))}</td>
                <td className="px-4 py-3.5">
                  <span className={cn("badge", o.payment_status === "paid" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800")}>
                    {o.payment_status}
                  </span>
                  <div className="mt-1 text-[10px] uppercase text-stone-400">{o.payment_method ?? "—"}</div>
                </td>
                <td className="px-4 py-3.5 text-xs text-stone-500">
                  <div>{format(new Date(o.created_at), "d MMM yyyy")}</div>
                  <div className="text-stone-400">{format(new Date(o.created_at), "h:mm a")}</div>
                </td>
                <td className="px-4 py-3.5 capitalize text-stone-600">{o.status.replace(/_/g, " ")}</td>
              </tr>
            ))}
            {(orders ?? []).length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-stone-400">No orders match that filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
