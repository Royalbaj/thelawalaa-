import { format } from "date-fns";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr, cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  await requireAuth();

  const [{ data: order }, { data: items }, { data: delivery }] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select(`
        id, order_number, daily_number, status, type, subtotal, delivery_fee, discount_amount, total,
        payment_status, payment_method, paid_confirmed_at, created_at, notes,
        customer:customer_id(full_name, phone),
        address:delivery_address_id(label, full_address),
        promo:promo_code_id(code),
        paid_by:paid_confirmed_by(full_name)
      `)
      .eq("id", params.id)
      .single(),
    supabaseAdmin.from("order_items").select("product_name, quantity, product_price, line_total, customization_notes").eq("order_id", params.id),
    supabaseAdmin
      .from("deliveries")
      .select("assigned_at, picked_up_at, on_the_way_at, delivered_at, otp_verified, rating, driver:driver_id(full_name)")
      .eq("order_id", params.id)
      .maybeSingle(),
  ]);

  if (!order) notFound();
  const o = order as any;

  return (
    <div className="space-y-5">
      <Link href="/orders" className="inline-flex items-center gap-1.5 text-sm font-bold text-stone-500 hover:text-brand-brown">
        <ArrowLeft size={15} /> Back to orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono font-display text-2xl font-bold text-brand-brown">{o.order_number}</h1>
          <p className="mt-0.5 text-sm text-stone-500">{format(new Date(o.created_at), "d MMM yyyy, h:mm a")} · {o.type}</p>
        </div>
        <div className="flex gap-2">
          <span className={cn("badge", o.payment_status === "paid" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800")}>{o.payment_status}</span>
          <span className="badge bg-stone-100 text-stone-700 capitalize">{o.status.replace(/_/g, " ")}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Customer</p>
          <p className="mt-1 font-bold text-brand-brown">{o.customer?.full_name ?? "Guest"}</p>
          {o.customer?.phone && <p className="text-sm text-stone-500">{o.customer.phone}</p>}
          {o.address && <p className="mt-2 text-sm text-stone-500">{o.address.label}: {o.address.full_address}</p>}
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Payment</p>
          <p className="mt-1 text-sm text-stone-600">Method: <span className="font-bold uppercase">{o.payment_method ?? "—"}</span></p>
          {o.paid_by?.full_name && (
            <p className="text-sm text-stone-600">
              Confirmed by <span className="font-bold">{o.paid_by.full_name}</span>
              {o.paid_confirmed_at && ` on ${format(new Date(o.paid_confirmed_at), "d MMM, h:mm a")}`}
            </p>
          )}
          {o.promo?.code && <p className="text-sm text-brand-green">Promo applied: {o.promo.code} (−{npr(Number(o.discount_amount))})</p>}
        </div>
      </div>

      {delivery && (
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Delivery</p>
          <p className="mt-1 text-sm text-stone-600">Driver: <span className="font-bold">{(delivery as any).driver?.full_name ?? "Unassigned"}</span></p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-stone-500">
            {delivery.assigned_at && <span>Assigned: {format(new Date(delivery.assigned_at), "h:mm a")}</span>}
            {delivery.picked_up_at && <span>Picked up: {format(new Date(delivery.picked_up_at), "h:mm a")}</span>}
            {delivery.on_the_way_at && <span>On the way: {format(new Date(delivery.on_the_way_at), "h:mm a")}</span>}
            {delivery.delivered_at && <span>Delivered: {format(new Date(delivery.delivered_at), "h:mm a")}</span>}
          </div>
          <p className="mt-2 text-xs text-stone-500">OTP verified: {delivery.otp_verified ? "Yes" : "No"}{delivery.rating ? ` · Rated ${delivery.rating}/5` : ""}</p>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <p className="px-5 pt-5 text-xs font-bold uppercase tracking-wide text-stone-400">Items</p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50/50 text-left text-xs uppercase text-stone-400">
              <th className="px-5 py-2.5 font-bold">Item</th>
              <th className="px-5 py-2.5 font-bold">Qty</th>
              <th className="px-5 py-2.5 font-bold">Price</th>
              <th className="px-5 py-2.5 font-bold">Line total</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((it, i) => (
              <tr key={i} className="border-b border-stone-50 last:border-0">
                <td className="px-5 py-2.5 font-medium text-brand-brown">
                  {it.product_name}
                  {it.customization_notes && <div className="text-xs text-stone-400">{it.customization_notes}</div>}
                </td>
                <td className="px-5 py-2.5 text-stone-600">{it.quantity}</td>
                <td className="px-5 py-2.5 text-stone-600">{npr(Number(it.product_price))}</td>
                <td className="px-5 py-2.5 font-bold text-brand-brown">{npr(Number(it.line_total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-1 border-t border-stone-100 px-5 py-4 text-sm">
          <div className="flex justify-between text-stone-500"><span>Subtotal</span><span>{npr(Number(o.subtotal))}</span></div>
          {Number(o.delivery_fee) > 0 && <div className="flex justify-between text-stone-500"><span>Delivery fee</span><span>{npr(Number(o.delivery_fee))}</span></div>}
          {Number(o.discount_amount) > 0 && <div className="flex justify-between text-brand-green"><span>Discount</span><span>−{npr(Number(o.discount_amount))}</span></div>}
          <div className="flex justify-between pt-1 font-display text-base font-bold text-brand-brown"><span>Total</span><span>{npr(Number(o.total))}</span></div>
        </div>
      </div>

      {o.notes && (
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Notes</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600">{o.notes}</p>
        </div>
      )}
    </div>
  );
}
