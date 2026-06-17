"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { npr, STATUS_COLORS, cn } from "@/lib/utils";

const DELIVERY_STEPS = ["pending", "confirmed", "preparing", "on_the_way", "delivered"];
const PICKUP_STEPS = ["pending", "confirmed", "preparing", "ready", "delivered"];
const LABELS: Record<string, string> = {
  pending: "Order placed", confirmed: "Confirmed", preparing: "Preparing",
  ready: "Ready for pickup", on_the_way: "Out for delivery", delivered: "Done!",
};

export default function TrackPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // RLS guarantees only the owner / assigned driver can read this row.
    supabase.from("orders").select("*").eq("id", orderId).maybeSingle().then(({ data }) => {
      if (!data) setNotFound(true);
      else setOrder(data);
    });
    supabase.from("order_items").select("product_name, quantity, line_total").eq("order_id", orderId)
      .then(({ data }) => setItems(data ?? []));

    const channel = supabase
      .channel(`order-${orderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => setOrder(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  if (notFound)
    return <div className="flex min-h-screen items-center justify-center bg-brand-cream"><p className="font-bold">Order not found, or you don&apos;t have access to it.</p></div>;
  if (!order)
    return <div className="flex min-h-screen items-center justify-center bg-brand-cream"><p className="animate-pulse font-bold">Loading your order…</p></div>;

  const steps = order.type === "pickup" ? PICKUP_STEPS : DELIVERY_STEPS;
  const statusIndex = (s: string) =>
    s === "cancelled" ? -1
    : ["assigned", "picked_up"].includes(s) ? steps.indexOf("on_the_way") - 0.5
    : steps.indexOf(s);
  const current = statusIndex(order.status);

  return (
    <div className="min-h-screen bg-brand-cream px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-sm text-stone-500">{order.order_number}</p>
              <p className="text-sm text-stone-500">{format(new Date(order.created_at), "d MMM yyyy, h:mm a")}</p>
            </div>
            <span className={cn("badge", STATUS_COLORS[order.status])}>{order.status.replace(/_/g, " ")}</span>
          </div>

          {order.status === "cancelled" ? (
            <p className="mt-6 rounded-xl bg-red-50 p-4 font-bold text-brand-red">This order was cancelled.</p>
          ) : (
            <ol className="mt-8 space-y-0">
              {steps.map((s, i) => {
                const done = current >= i;
                const isCurrent = Math.floor(current) === i && order.status !== "delivered";
                return (
                  <li key={s} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                        done ? "bg-brand-orange text-white" : "bg-stone-200 text-stone-500",
                        isCurrent && "animate-pulse ring-4 ring-brand-orange/30"
                      )}>
                        {done ? "✓" : i + 1}
                      </span>
                      {i < steps.length - 1 && <span className={cn("h-8 w-0.5", done ? "bg-brand-orange" : "bg-stone-200")} />}
                    </div>
                    <p className={cn("pt-1 font-bold", done ? "text-stone-900" : "text-stone-400")}>{LABELS[s]}</p>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-8 border-t pt-4">
            <h2 className="font-display font-bold">Items</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {items.map((i, idx) => (
                <li key={idx} className="flex justify-between"><span>{i.quantity}× {i.product_name}</span><span>{npr(Number(i.line_total))}</span></li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between border-t pt-2 font-bold"><span>Total</span><span>{npr(Number(order.total))}</span></p>
            <p className="mt-1 text-xs text-stone-500">
              {order.payment_method?.toUpperCase()} · {order.payment_status === "paid" ? "Paid ✓" : order.payment_method === "qr" ? "Scan QR on arrival" : "Pay cash on arrival"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
