"use client";
// Live order feed. Realtime payloads are TRIGGERS to refetch through the
// authenticated server — never trusted as data on their own.
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { npr, STATUS_COLORS, cn } from "@/lib/utils";
import OrderStatusSelect from "./order-status-select";
import MarkPaidButton from "./mark-paid-button";

type Row = {
  id: string; order_number: string; daily_number: number | null; status: string; type: string;
  total: number; payment_status: string; payment_method: string | null; created_at: string;
};

export default function RealtimeFeed({ initial }: { initial: Row[] }) {
  const [orders, setOrders] = useState<Row[]>(initial);
  // Fresh rows from the server (the header's refresh button re-renders the page).
  useEffect(() => { setOrders(initial); }, [initial]);

  useEffect(() => {
    const supabase = createClient();
    const refetch = async () => {
      const res = await fetch("/admin/orders/feed", { cache: "no-store" }).catch(() => null);
      if (res?.ok) setOrders(await res.json());
    };
    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        if (payload.eventType === "INSERT") toast.success("New order in!");
        refetch();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <>
    <div className="space-y-2.5 md:hidden">
      {orders.map((o) => (
        <div key={o.id} className="card p-3.5">
          <div className="flex items-start justify-between gap-3">
            <p className="flex flex-wrap items-center gap-1.5">
              {o.daily_number != null && o.type === "pickup" && (
                <span className="rounded-full bg-brand-orange/10 px-2 py-0.5 text-xs font-extrabold text-brand-orange">#{String(o.daily_number).padStart(2, "0")}</span>
              )}
              <span className="font-mono text-sm font-bold">{o.order_number}</span>
              <span className="text-xs capitalize text-stone-500">· {o.type.replace("_", " ")} · {format(new Date(o.created_at), "h:mm a")}</span>
            </p>
            <p className="shrink-0 font-bold">{npr(Number(o.total))}</p>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <MarkPaidButton orderId={o.id} total={Number(o.total)} paid={o.payment_status === "paid"} method={o.payment_method} />
            <span className="ml-auto"><OrderStatusSelect orderId={o.id} status={o.status} type={o.type} /></span>
          </div>
        </div>
      ))}
      {orders.length === 0 && <div className="card px-4 py-8 text-center text-sm text-stone-500">No orders yet today.</div>}
    </div>
    <div className="card hidden overflow-x-auto md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-orange-100 text-left text-xs uppercase text-stone-500">
            <th className="px-4 py-3">Order</th><th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Total</th><th className="px-4 py-3">Payment</th>
            <th className="px-4 py-3">Time</th><th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-orange-50 last:border-0">
              <td className="px-4 py-3 font-mono font-bold">
                {o.daily_number != null && o.type === "pickup" && (
                  <span className="mr-1.5 inline-flex items-center rounded-full bg-brand-orange/10 px-2 py-0.5 text-xs font-extrabold text-brand-orange">#{String(o.daily_number).padStart(2, "0")}</span>
                )}
                {o.order_number}
              </td>
              <td className="px-4 py-3 capitalize">{o.type.replace("_", " ")}</td>
              <td className="px-4 py-3 font-bold">{npr(Number(o.total))}</td>
              <td className="px-4 py-3">
                <MarkPaidButton orderId={o.id} total={Number(o.total)} paid={o.payment_status === "paid"} method={o.payment_method} />
              </td>
              <td className="px-4 py-3 text-stone-500">{format(new Date(o.created_at), "h:mm a")}</td>
              <td className="px-4 py-3"><OrderStatusSelect orderId={o.id} status={o.status} type={o.type} /></td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-500">No orders yet today.</td></tr>
          )}
        </tbody>
      </table>
    </div>
    </>
  );
}
