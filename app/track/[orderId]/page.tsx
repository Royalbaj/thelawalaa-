"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { KeyRound, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { npr, STATUS_COLORS, cn } from "@/lib/utils";
import { orderSteps, orderStep, orderStatusLabel } from "@/lib/order-status";
import BrandLogo from "@/components/brand-logo";
import { BrandLoader } from "@/components/brand-loader";
import { guestCodeKey } from "@/lib/guest-order";

type TrackOrder = {
  id: string; order_number: string; daily_number: number | null; status: string; type: string;
  total: number | null; payment_status: string; payment_method: string | null; created_at: string; delivery_address: string | null;
};
type TrackItem = { product_name: string; quantity: number; line_total: number | null };

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
  const [order, setOrder] = useState<TrackOrder | null>(null);
  const [items, setItems] = useState<TrackItem[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isGuestViewer, setIsGuestViewer] = useState(false);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsGuestViewer(!data.user));
    try { setCode(sessionStorage.getItem(guestCodeKey(orderId))); } catch { /* private mode */ }

    // The order id (an unguessable UUID) is the intended access model —
    // fetched via a server route that only ever looks up by exact id,
    // never a listable RLS policy. Polled instead of a realtime
    // subscription so this page needs no RLS grant on orders at all.
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/track/${orderId}`, { cache: "no-store" });
      if (cancelled) return;
      if (!res.ok) { setNotFound(true); return; }
      const body = await res.json();
      setOrder(body.order);
      setItems(body.items);
      if (body.deliveryCode) setCode(body.deliveryCode);
    }
    load();
    const interval = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [orderId]);

  useEffect(() => {
    if (!order) return;
    document.title = `${orderStatusLabel(order.status, order.type)} · Thelawalaa`;
    return () => { document.title = "Thelawalaa"; };
  }, [order]);

  const header = (
    <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
        <Link href="/"><BrandLogo size="sm" /></Link>
        <Link href="/order" className="rounded-full bg-brand-orange px-4 py-2 text-sm font-bold text-white shadow-sm shadow-orange-500/30">Order again</Link>
      </div>
    </header>
  );

  if (notFound)
    return <div className="min-h-dvh bg-brand-cream">{header}<p className="px-4 py-20 text-center font-bold text-stone-600">Order not found, or you don&apos;t have access to it.</p></div>;
  if (!order)
    return <div className="min-h-dvh bg-brand-cream">{header}<div className="py-24"><BrandLoader label="Loading your order…" /></div></div>;

  const steps = orderSteps(order.type);
  const current = orderStep(order.status, order.type); // 3 = collected/delivered, -1 = cancelled
  const done = current === 3 || order.status === "cancelled";
  const readyToCollect = order.type !== "delivery" && order.status === "ready";

  return (
    <div className="min-h-dvh bg-brand-cream">
      {header}
      <div className="mx-auto max-w-xl px-4 py-6 sm:py-10">
        {payment === "success" && (
          <p className="mb-4 rounded-xl bg-green-50 p-4 text-center font-bold text-brand-green">Payment received via eSewa</p>
        )}
        {payment === "failed" && (
          <p className="mb-4 rounded-xl bg-amber-50 p-4 text-center font-bold text-amber-700">Payment didn&apos;t go through — you can pay cash on arrival, or try eSewa again from support.</p>
        )}
        {order.type === "pickup" && order.status !== "cancelled" && !done && (
          <div className={cn("mb-4 rounded-2xl border-2 border-dashed p-5 text-center",
            readyToCollect ? "border-brand-green bg-green-50" : "border-brand-orange bg-orange-50")}>
            <p className={cn("text-xs font-bold uppercase tracking-wide", readyToCollect ? "text-brand-green" : "text-brand-orange")}>
              {readyToCollect ? "Ready! Show this number at the counter" : "Tell our counter staff this number"}
            </p>
            {order.daily_number != null ? (
              <p className="mt-1 font-mono text-6xl font-extrabold tracking-wider text-brand-brown">{String(order.daily_number).padStart(2, "0")}</p>
            ) : (
              <p className="mt-1 font-mono text-3xl font-extrabold tracking-wider text-brand-brown">{order.order_number}</p>
            )}
            <p className="mt-1 font-mono text-xs text-stone-500">{order.order_number}</p>
          </div>
        )}
        {order.type === "delivery" && !done && code && (
          <div className="mb-4 flex items-center gap-4 rounded-2xl border-2 border-dashed border-brand-orange bg-orange-50 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-orange shadow-sm"><KeyRound size={22} /></span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-orange">Your delivery code</p>
              <p className="font-mono text-4xl font-extrabold tracking-[0.3em] text-brand-brown">{code}</p>
              <p className="text-xs text-stone-500">Give it to our rider only when you have your food.</p>
            </div>
          </div>
        )}
        {isGuestViewer && !done && (
          <div className="mb-4 rounded-2xl bg-gradient-to-br from-brand-orange to-amber-500 p-5 text-center text-white shadow-lg">
            <p className="font-display text-lg font-bold">Earn points on your next order</p>
            <p className="mt-1 text-sm text-white/90">Create a free account to track orders, save addresses and collect rewards.</p>
            <Link href="/auth/signup" className="mt-3 inline-block rounded-full bg-white px-6 py-2 text-sm font-bold text-brand-orange transition hover:bg-orange-50">
              Create an account
            </Link>
          </div>
        )}
        <div className="card p-6">
          <div className="flex items-center justify-between gap-3">
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
                const reached = current >= i;
                const isCurrent = current === i;
                return (
                  <li key={label} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                        reached ? "bg-brand-orange text-white" : "bg-stone-200 text-stone-500",
                        isCurrent && "animate-pulse ring-4 ring-brand-orange/30"
                      )}>
                        {reached ? "✓" : i + 1}
                      </span>
                      {i < steps.length - 1 && <span className={cn("h-8 w-0.5", reached ? "bg-brand-orange" : "bg-stone-200")} />}
                    </div>
                    <p className={cn("pt-1 font-bold", reached ? "text-stone-900" : "text-stone-400")}>{label}</p>
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

          {order.type === "delivery" && order.delivery_address && !done && (
            <p className="mt-6 flex gap-2 rounded-xl bg-stone-50 p-3 text-sm text-stone-600"><MapPin size={16} className="mt-0.5 shrink-0 text-brand-orange" /> {order.delivery_address}</p>
          )}

          <div className="mt-8 border-t pt-4">
            <h2 className="font-display font-bold">Items</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {items.map((i, idx) => (
                <li key={idx} className="flex justify-between gap-3">
                  <span>{i.quantity}× {i.product_name}</span>
                  {i.line_total != null && <span>{npr(Number(i.line_total))}</span>}
                </li>
              ))}
            </ul>
            {order.total != null && (
              <>
                <p className="mt-3 flex justify-between border-t pt-2 font-bold"><span>{order.payment_status === "paid" ? "Total" : "To pay"}</span><span>{npr(Number(order.total))}</span></p>
                <p className="mt-1 text-xs text-stone-500">
                  {order.payment_method?.toUpperCase()} · {order.payment_status === "paid" ? "Paid ✓" : order.payment_method === "qr" ? "Scan QR on arrival" : order.payment_method === "esewa" ? "Payment pending" : order.type === "delivery" ? "Pay cash on arrival" : "Pay cash at the counter"}
                </p>
              </>
            )}
          </div>

          {order.status === "delivered" && !isGuestViewer && (
            <div className="mt-6 border-t border-stone-100 pt-6">
              <h2 className="mb-2 text-center font-display text-lg font-bold text-brand-brown">How was your food?</h2>
              {rated ? (
                <p className="text-center text-sm font-bold text-brand-green">Thanks for your rating!</p>
              ) : (
                <>
                  <p className="mb-4 text-center text-xs text-stone-500">Rate your order to help us improve.</p>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        aria-label={`${star} star${star > 1 ? "s" : ""}`}
                        onClick={async () => {
                          const { submitOrderRating } = await import("@/app/actions/customer");
                          const res = await submitOrderRating(order.id, star, null, null);
                          if (res.ok) setRated(true);
                        }}
                        className="text-3xl text-stone-300 transition hover:scale-110 hover:text-amber-400"
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {done && (
            <p className="mt-5 text-center text-sm">
              <Link href={`/feedback?order=${encodeURIComponent(order.order_number)}`} className="font-bold text-brand-orange">Tell us how it was — leave feedback →</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
