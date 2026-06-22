"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { npr, cn } from "@/lib/utils";
import { adminUpdateOrderStatus, assignDriver, markOrderPaid } from "@/app/actions/staff";
import toast from "react-hot-toast";

interface Order {
  id: string;
  order_number: string;
  status: string;
  type: string;
  total: number;
  payment_status: string;
  payment_method: string | null;
  created_at: string;
  notes: string | null;
  customer?: { full_name: string; phone: string | null } | null;
}

interface Driver {
  id: string;
  full_name: string;
  is_online: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-purple-100 text-purple-800",
  ready: "bg-green-100 text-green-800",
  assigned: "bg-cyan-100 text-cyan-800",
  picked_up: "bg-indigo-100 text-indigo-800",
  on_the_way: "bg-violet-100 text-violet-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
};

const NEXT_STATUS: Record<string, string> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "delivered",
};

export default function LiveOrdersPanel({ initialOrders, drivers }: { initialOrders: Order[]; drivers: Driver[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<string>("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setOrders((prev) => [payload.new as Order, ...prev].slice(0, 50));
          toast("🔔 New order!", { icon: "📦" });
        } else if (payload.eventType === "UPDATE") {
          setOrders((prev) => prev.map((o) => (o.id === payload.new.id ? { ...o, ...payload.new } : o)));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const activeStatuses = ["pending", "confirmed", "preparing", "ready", "assigned", "picked_up", "on_the_way"];
  const filtered = filter === "active"
    ? orders.filter((o) => activeStatuses.includes(o.status))
    : filter === "all" ? orders : orders.filter((o) => o.status === filter);

  function getCustomerName(o: Order) {
    if (o.notes) {
      const match = o.notes.match(/Name:\s*([^\n]+)/);
      if (match) return match[1];
    }
    if (o.customer) return o.customer.full_name;
    return "Walk-in";
  }

  function getCustomerPhone(o: Order) {
    if (o.notes) {
      const match = o.notes.match(/Phone:\s*([^\n]+)/);
      if (match && match[1] !== "N/A") return match[1];
    }
    if (o.customer) return o.customer.phone;
    return null;
  }

  function getAddress(o: Order) {
    if (!o.notes) return null;
    const match = o.notes.match(/Address:\s*([^\n]+)/);
    return match ? match[1] : null;
  }

  async function advanceStatus(o: Order) {
    const next = NEXT_STATUS[o.status];
    if (!next) return;
    const res = await adminUpdateOrderStatus(o.id, next);
    if ("error" in res) { toast.error(res.error as string); return; }
    toast.success(`→ ${next}`);
  }

  async function handleAssignDriver(orderId: string, driverId: string) {
    const res = await assignDriver(orderId, driverId);
    if ("error" in res) { toast.error(res.error as string); return; }
    toast.success("Driver assigned!");
  }

  async function handleMarkPaid(orderId: string) {
    const res = await markOrderPaid(orderId);
    if ("error" in res) { toast.error(res.error as string); return; }
    toast.success("✅ Paid!");
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-stone-100 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm text-brand-brown flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-green animate-pulse" />
            Live Orders
          </h3>
          <span className="text-[10px] font-bold text-stone-400">{filtered.length} orders</span>
        </div>
        <div className="flex gap-1">
          {["active", "pending", "preparing", "ready", "all"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold capitalize transition", filter === f ? "bg-brand-orange text-white" : "bg-stone-100 text-stone-500")}>{f}</button>
          ))}
        </div>
      </div>

      {/* Order List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-2xl mb-1">📋</p>
            <p className="text-xs text-stone-400">No orders</p>
          </div>
        )}
        {filtered.map((o) => (
          <div key={o.id} className={cn("rounded-xl border p-3 transition-all cursor-pointer", o.status === "pending" ? "border-amber-300 bg-amber-50/50 ring-1 ring-amber-200" : "border-stone-100 hover:border-stone-200")} onClick={() => setExpandedId(expandedId === o.id ? null : o.id)}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-mono text-xs font-bold text-brand-brown">{o.order_number}</span>
                <span className="ml-2 text-[10px] text-stone-500">
                  {getCustomerName(o)}
                  {getCustomerPhone(o) ? ` • ${getCustomerPhone(o)}` : ""}
                </span>
              </div>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", STATUS_COLORS[o.status] ?? "bg-stone-100")}>
                {o.status.replace(/_/g, " ")}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px] font-bold rounded px-1.5 py-0.5", o.type === "delivery" ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600")}>
                  {o.type === "delivery" ? "🛵" : "🏪"} {o.type}
                </span>
                <span className={cn("text-[10px] font-bold rounded px-1.5 py-0.5", o.payment_status === "paid" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600")}>
                  {o.payment_status === "paid" ? "✅ Paid" : "⏳ Unpaid"}
                </span>
              </div>
              <span className="font-bold text-xs text-brand-orange">{npr(Number(o.total))}</span>
            </div>

            {/* Expanded Actions */}
            {expandedId === o.id && (
              <div className="mt-3 pt-2 border-t border-stone-100 space-y-2" onClick={(e) => e.stopPropagation()}>
                <p className="text-[10px] text-stone-400">{format(new Date(o.created_at), "d MMM, h:mm a")}</p>
                {o.type === "delivery" && getAddress(o) && (
                  <p className="text-[11px] font-bold text-stone-600 bg-stone-50 p-1.5 rounded">📍 {getAddress(o)}</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {NEXT_STATUS[o.status] && (
                    <button onClick={() => advanceStatus(o)} className="rounded-lg bg-brand-orange text-white px-3 py-1.5 text-[11px] font-bold hover:brightness-110 transition">
                      → {NEXT_STATUS[o.status].replace(/_/g, " ")}
                    </button>
                  )}
                  {o.payment_status !== "paid" && (
                    <button onClick={() => handleMarkPaid(o.id)} className="rounded-lg bg-green-600 text-white px-3 py-1.5 text-[11px] font-bold hover:brightness-110 transition">
                      💵 Mark Paid
                    </button>
                  )}
                  {o.status === "cancelled" ? null : (
                    <button onClick={() => { adminUpdateOrderStatus(o.id, "cancelled"); toast.success("Cancelled"); }} className="rounded-lg bg-red-100 text-red-600 px-3 py-1.5 text-[11px] font-bold hover:bg-red-200 transition">
                      ✕ Cancel
                    </button>
                  )}
                </div>

                {/* Driver Assignment */}
                {o.type === "delivery" && o.status === "ready" && (
                  <div className="mt-2">
                    <p className="text-[10px] font-bold text-stone-500 mb-1">Assign Driver:</p>
                    <div className="flex flex-wrap gap-1">
                      {drivers.filter((d) => d.is_online).map((d) => (
                        <button key={d.id} onClick={() => handleAssignDriver(o.id, d.id)} className="rounded-lg bg-cyan-50 text-cyan-700 px-2.5 py-1 text-[10px] font-bold hover:bg-cyan-100 transition border border-cyan-200">
                          🛵 {d.full_name}
                        </button>
                      ))}
                      {drivers.filter((d) => d.is_online).length === 0 && (
                        <p className="text-[10px] text-stone-400">No drivers online</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
