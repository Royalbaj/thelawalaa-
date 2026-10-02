"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { npr, STATUS_COLORS, cn } from "@/lib/utils";
import { orderSteps, orderStep, orderStatusLabel } from "@/lib/order-status";

export default function TrackPage() {
  return (
    <Suspense>
      <TrackContent />
    </Suspense>
  );
}

function TrackContent() {
  const { orderId } = useParams<{ orderId: string }>();
  const payment = useSearchParams().get("payment");
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [isGuestViewer, setIsGuestViewer] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsGuestViewer(!data.user));

    // The order id (an unguessable UUID) is the intended access model —
    // fetched via a server route that only ever looks up by exact id,
    // never a listable RLS policy. Polled instead of a realtime
    // subscription so this page needs no RLS grant on orders at all.
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/track/${orderId}`, { cache: "no-store" });
      if (cancelled) return;
      if (!res.ok) { setNotFound(true); return; }
      const { order, items } = await res.json();
      setOrder(order);
      setItems(items);
    }
    load();
    const interval = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [orderId]);

  useEffect(() => {
    if (!order) return;
    document.title = `${orderStatusLabel(order.status, order.type)} · Thelawalaa`;
    return () => { document.title = "Thelawalaa"; };
  }, [order?.status, order?.type]);

  if (notFound)
    return <div className="flex min-h-screen items-center justify-center bg-brand-cream"><p className="font-bold">Order not found, or you don&apos;t have access to it.</p></div>;
  if (!order)
    return <div className="flex min-h-screen items-center justify-center bg-brand-cream"><p className="animate-pulse font-bold">Loading your order…</p></div>;

  const steps = orderSteps(order.type);
  const current = orderStep(order.status, order.type); // 3 = collected/delivered, -1 = cancelled
  const readyToCollect = order.type !== "delivery" && order.status === "ready";

  return (
    <div className="min-h-screen bg-brand-cream px-4 py-10">
      <div className="mx-auto max-w-xl">
        {payment === "success" && (
          <p className="mb-4 rounded-xl bg-green-50 p-4 text-center font-bold text-brand-green">Payment received via eSewa</p>
        )}
        {payment === "failed" && (
          <p className="mb-4 rounded-xl bg-amber-50 p-4 text-center font-bold text-amber-700">Payment didn&apos;t go through — you can pay cash on arrival, or try eSewa again from support.</p>
        )}
        {order.type === "pickup" && order.status !== "cancelled" && (
          <div className={cn("mb-4 rounded-2xl border-2 border-dashed p-5 text-center",
            readyToCollect ? "border-brand-green bg-green-50" : "border-brand-orange bg-orange-50")}>
            <p className={cn("text-xs font-bold uppercase tracking-wide", readyToCollect ? "text-brand-green" : "text-brand-orange")}>
              {readyToCollect ? "Ready! Show this number at the counter" : "Tell our counter staff this number"}
            </p>
            {order.daily_number != null ? (
              <p className="mt-1 font-mono text-6xl font-extrabold text-brand-brown tracking-wider">{String(order.daily_number).padStart(2, "0")}</p>
            ) : (
              <p className="mt-1 font-mono text-3xl font-extrabold text-brand-brown tracking-wider">{order.order_number}</p>
            )}
            <p className="mt-1 text-xs text-stone-500 font-mono">{order.order_number}</p>
          </div>
        )}
        {isGuestViewer && (
          <div className="mb-4 rounded-2xl bg-gradient-to-br from-brand-orange to-amber-500 p-5 text-center text-white shadow-lg">
            <p className="font-display font-bold text-lg">Sign up to get great offers</p>
            <p className="mt-1 text-sm text-white/90">Create a free account to save your addresses, track past orders, and get exclusive deals.</p>
            <a href="/auth/signup" className="mt-3 inline-block rounded-full bg-white px-6 py-2 text-sm font-bold text-brand-orange hover:bg-orange-50 transition">
              Sign Up Free
            </a>
          </div>
        )}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-sm text-stone-500">{order.order_number}</p>
              <p className="text-sm text-stone-500">{format(new Date(order.created_at), "d MMM yyyy, h:mm a")}</p>
            </div>
            <span className={cn("badge", STATUS_COLORS[order.status])}>{orderStatusLabel(order.status, order.type)}</span>
          </div>

          {order.status === "cancelled" ? (
            <p className="mt-6 rounded-xl bg-red-50 p-4 font-bold text-brand-red">This order was cancelled.</p>
          ) : (
            <ol className="mt-8 space-y-0">
              {steps.map((label, i) => {
                const done = current >= i;
                const isCurrent = current === i;
                return (
                  <li key={label} className="flex gap-4">
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
                    <p className={cn("pt-1 font-bold", done ? "text-stone-900" : "text-stone-400")}>{label}</p>
                  </li>
                );
              })}
            </ol>
          )}
          {current === 3 && (
            <p className="mt-4 rounded-xl bg-green-50 p-4 text-center font-bold text-brand-green">
              {orderStatusLabel(order.status, order.type)} — enjoy your food!
            </p>
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
              {order.payment_method?.toUpperCase()} · {order.payment_status === "paid" ? "Paid ✓" : order.payment_method === "qr" ? "Scan QR on arrival" : order.payment_method === "esewa" ? "Payment pending" : "Pay cash on arrival"}
            </p>
          </div>

          {order.status === "delivered" && (
            <div className="mt-6 pt-6 border-t border-stone-100">
              <h2 className="font-display text-lg font-bold text-brand-brown text-center mb-2">How was your food?</h2>
              <p className="text-xs text-stone-500 text-center mb-4">Rate your order to help us improve!</p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={async () => {
                      const { submitOrderRating } = await import("@/app/actions/customer");
                      const res = await submitOrderRating(order.id, star, null, null);
                      if (res.ok) alert("Thanks for your rating!");
                    }}
                    className="text-3xl text-stone-300 hover:text-amber-400 hover:scale-110 transition"
                  >
                    ★
                  </button>
                ))}
              </div>
              <p className="mt-3 text-center text-sm">
                <a href={`/feedback?order=${encodeURIComponent(order.order_number)}`} className="font-bold text-brand-orange">Want to tell us more? Leave feedback →</a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
