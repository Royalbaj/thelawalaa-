import { format } from "date-fns";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr, cn } from "@/lib/utils";
import OrderStatusSelect from "@/components/admin/order-status-select";
import MarkPaidButton from "@/components/admin/mark-paid-button";

export const dynamic = "force-dynamic";

const TABS = ["all","pending","preparing","ready","on_the_way","delivered","cancelled"] as const;

export default async function AdminOrders({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  await requireRole(["admin"]);
  const status = TABS.includes((searchParams.status ?? "all") as never) ? searchParams.status : "all";
  const q = (searchParams.q ?? "").slice(0, 40);

    let query = supabaseAdmin
    .from("orders")
    .select("id, order_number, status, type, total, payment_status, payment_method, created_at, notes, discount_amount, promo_codes:promo_code_id(code), profiles:customer_id(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status && status !== "all") query = query.eq("status", status);
  if (q) query = query.ilike("order_number", `%${q}%`);
  const { data: orders } = await query;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <a key={t} href={`/admin/orders?status=${t}`}
             className={cn("rounded-full px-4 py-1.5 text-sm font-bold capitalize",
               status === t ? "bg-brand-orange text-white" : "bg-white text-stone-600 hover:bg-orange-50")}>
            {t.replace(/_/g, " ")}
          </a>
        ))}
        <form className="ml-auto" action="/admin/orders">
          <input name="q" defaultValue={q} placeholder="Search order #" className="input !w-48 !py-1.5 text-sm" />
        </form>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-orange-100 text-left text-xs uppercase text-stone-500">
              <th className="px-4 py-3">Order</th><th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Type</th><th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Payment</th><th className="px-4 py-3">Placed</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o: any) => {
              let customerName = o.profiles?.full_name;
              if (!customerName) {
                if (o.notes?.includes("[Guest Checkout]")) {
                  const match = o.notes.match(/Name:\s*([^\n]+)/);
                  customerName = match ? `${match[1]} (Guest)` : "Walk-in (Guest)";
                } else {
                  customerName = "Walk-in";
                }
              }
              return (
                <tr key={o.id} className="border-b border-orange-50 last:border-0">
                  <td className="px-4 py-3 font-mono font-bold">{o.order_number}</td>
                  <td className="px-4 py-3">{customerName}</td>
                  <td className="px-4 py-3 capitalize">{o.type.replace("_", " ")}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold">{npr(Number(o.total))}</div>
                    {Number(o.discount_amount) > 0 && o.promo_codes?.code && (
                      <div className="text-[10px] text-brand-green bg-green-50 px-1.5 py-0.5 rounded-full inline-block mt-1 font-bold">
                        Voucher: {o.promo_codes.code} (-{npr(Number(o.discount_amount))})
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="font-bold uppercase">{o.payment_method ?? "—"}</span>{" "}
                    <MarkPaidButton orderId={o.id} total={Number(o.total)} paid={o.payment_status === "paid"} method={o.payment_method} />
                  </td>
                  <td className="px-4 py-3 text-stone-500">{format(new Date(o.created_at), "d MMM, h:mm a")}</td>
                  <td className="px-4 py-3"><OrderStatusSelect orderId={o.id} status={o.status} /></td>
                </tr>
              );
            })}
            {(orders ?? []).length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-500">Nothing here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
