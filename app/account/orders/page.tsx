"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { npr, STATUS_COLORS, cn } from "@/lib/utils";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    createClient().from("orders")
      .select("id, order_number, status, total, type, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => { setOrders(data ?? []); setLoaded(true); });
  }, []);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-brand-brown">Your orders</h1>
      {loaded && orders.length === 0 && (
        <div className="card mt-6 p-8 text-center">
          <p className="font-bold">No orders yet — your first panipuri awaits.</p>
          <Link href="/order" className="btn-primary mt-4">Browse menu</Link>
        </div>
      )}
      <ul className="mt-6 space-y-3">
        {orders.map((o) => (
          <li key={o.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-mono text-sm font-bold">{o.order_number}</p>
              <p className="text-xs text-stone-500">{format(new Date(o.created_at), "d MMM, h:mm a")} · {o.type}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn("badge", STATUS_COLORS[o.status])}>{o.status.replace(/_/g, " ")}</span>
              <span className="font-bold">{npr(Number(o.total))}</span>
              <Link href={`/track/${o.id}`} className="rounded-full bg-brand-orange px-4 py-1.5 text-sm font-bold text-white">Track</Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
