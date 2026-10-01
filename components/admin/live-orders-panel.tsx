"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { npr, cn, STATUS_COLORS } from "@/lib/utils";
import { orderStatusLabel, nextCounterAction, STATUS_FILTERS } from "@/lib/order-status";
import { noteField, customerNote } from "@/lib/order-notes";
import { playOrderSound } from "@/lib/order-sound";
import { adminUpdateOrderStatus, assignDriver, markOrderPaid, getOrderLines, getLiveOrders } from "@/app/actions/staff";
import { MEMBER_PRICE_LABEL } from "@/lib/discounts";

interface Line { product_name: string; quantity: number }

export interface Order {
  id: string;
  order_number: string;
  daily_number: number | null;
  status: string;
  type: string;
  total: number;
  discount_label?: string | null;
  payment_status: string;
  payment_method: string | null;
  created_at: string;
  notes: string | null;
  customer?: { full_name: string; phone: string | null } | null;
  items?: Line[];
}

interface Driver {
  id: string;
  full_name: string;
  is_online: boolean;
}

const CLOSED = ["delivered", "cancelled"];
const CHIPS = [
  { key: "active", label: "Active" },
  ...STATUS_FILTERS.filter((f) => ["pending", "confirmed", "ready"].includes(f.key)),
  { key: "all", label: "All" },
];

const customerName = (o: Order) => noteField(o.notes, "Name") ?? o.customer?.full_name ?? "Walk-in";
const customerPhone = (o: Order) => noteField(o.notes, "Phone") ?? o.customer?.phone ?? null;
const kitchenNote = (o: Order) => customerNote(o.notes);

export default function LiveOrdersPanel({
  initialOrders, drivers, onNewOrder, onNewCount,
}: {
  initialOrders: Order[];
  drivers: Driver[];
  /** A new online order arrived (the chime has already played). Default: a toast. */
  onNewOrder?: (o: Order) => void;
  /** How many orders are waiting to be confirmed — for a badge outside the panel. */
  onNewCount?: (n: number) => void;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState("active");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lingering, setLingering] = useState<string[]>([]);
  const [, setTick] = useState(0);
  const busyRef = useRef<string | null>(null);
  const known = useRef(new Set(initialOrders.map((o) => o.id)));

  const setBusy = (id: string | null) => { busyRef.current = id; setBusyId(id); };

  // Counter orders start confirmed — only a new online order needs someone's attention.
  const announce = (o: Order) => {
    if (known.current.has(o.id)) return;
    known.current.add(o.id);
    if (o.status !== "pending") return;
    playOrderSound();
    if (onNewOrder) onNewOrder(o); else toast("New online order!", { icon: "🔔" });
  };

  // A card that's just been closed stays put (dimmed) for a moment instead of
  // vanishing — so the next card never slides under a quick second tap.
  const linger = (id: string) => {
    setLingering((l) => [...l, id]);
    setTimeout(() => setLingering((l) => l.filter((x) => x !== id)), 2500);
  };

  const patch = (id: string, changes: Partial<Order>) =>
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...changes } : o)));

  // Items are inserted just after the order row, so the first look can come back empty.
  const loadLines = (id: string, tries = 3) =>
    getOrderLines(id)
      .then((items) => {
        if (items.length || tries <= 1) patch(id, { items });
        else setTimeout(() => loadLines(id, tries - 1), 1500);
      })
      .catch(() => {});

  useEffect(() => {
    // Safety net: Realtime can silently drop on a flaky connection or a tablet
    // that slept, so re-sync the whole list every 20s while the POS is on
    // screen, and straight away when it comes back into view or reconnects.
    const sync = () => {
      if (document.visibilityState !== "visible" || busyRef.current) return;
      getLiveOrders()
        .then((data) => {
          if (busyRef.current) return; // never stomp a tap that's still in flight
          const fresh = data as unknown as Order[];
          fresh.forEach(announce);
          setOrders(fresh);
        })
        .catch(() => {});
    };

    const supabase = createClient();
    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const o = payload.new as Order;
          setOrders((prev) => [o, ...prev.filter((x) => x.id !== o.id)].slice(0, 50));
          loadLines(o.id);
          announce(o);
        } else if (payload.eventType === "UPDATE") {
          patch(payload.new.id, payload.new as Partial<Order>);
        } else if (payload.eventType === "DELETE") {
          setOrders((prev) => prev.filter((x) => x.id !== payload.old.id)); // e.g. the opening-day reset
        }
      })
      .subscribe((status) => { if (status === "SUBSCRIBED") sync(); });

    const poll = setInterval(sync, 20_000);
    const clock = setInterval(() => setTick((n) => n + 1), 30_000); // keeps "5 min ago" current
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      active: orders.filter((o) => !CLOSED.includes(o.status)).length,
      all: orders.length,
    };
    for (const f of STATUS_FILTERS) c[f.key] = orders.filter((o) => f.statuses.includes(o.status)).length;
    return c;
  }, [orders]);

  useEffect(() => { onNewCount?.(counts.pending); }, [counts.pending, onNewCount]);

  // Newest first and never re-sorted on a tap — cards must not jump under a finger.
  const visible = useMemo(() => {
    if (filter === "active") return orders.filter((o) => !CLOSED.includes(o.status) || lingering.includes(o.id));
    if (filter === "all") return orders;
    const statuses = STATUS_FILTERS.find((f) => f.key === filter)?.statuses ?? [];
    return orders.filter((o) => statuses.includes(o.status) || lingering.includes(o.id));
  }, [orders, filter, lingering]);

  // Every action updates the card instantly; Realtime confirms it a moment later.
  // A thrown action (e.g. an expired login) must still roll the card back.
  const offline = () => ({ error: "Couldn't reach the server — check the connection and try again" });

  async function move(o: Order, status: string) {
    setBusy(o.id);
    if (CLOSED.includes(status)) linger(o.id);
    patch(o.id, { status });
    const r = await adminUpdateOrderStatus(o.id, status).catch(offline);
    setBusy(null);
    if (r?.error) { patch(o.id, { status: o.status }); toast.error(r.error); return false; }
    return true;
  }

  async function markPaid(o: Order) {
    setBusy(o.id);
    patch(o.id, { payment_status: "paid" });
    const r = await markOrderPaid(o.id).catch(offline);
    setBusy(null);
    if (r?.error) { patch(o.id, { payment_status: o.payment_status }); toast.error(r.error); return false; }
    return true;
  }

  // Ready and unpaid: taking the money and handing over the food is one moment, so it's one tap.
  async function payAndHandOver(o: Order, status: string) {
    if (await markPaid(o)) await move({ ...o, payment_status: "paid" }, status);
  }

  async function cancel(o: Order) {
    if (!confirm(`Cancel order #${o.daily_number ?? o.order_number}? The customer will see it as cancelled.`)) return;
    if (await move(o, "cancelled")) setExpandedId(null);
  }

  async function handleAssignDriver(orderId: string, driverId: string) {
    const res = await assignDriver(orderId, driverId);
    if ("error" in res) { toast.error(res.error as string); return; }
    toast.success("Driver assigned!");
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 flex flex-col h-full dark:bg-stone-900 dark:border-stone-800">
      {/* Header */}
      <div className="p-3 border-b border-stone-100 shrink-0 dark:border-stone-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-sm text-brand-brown flex items-center gap-1.5 dark:text-orange-100">
            <span className="h-2 w-2 rounded-full bg-brand-green animate-pulse" />
            Live Orders
          </h3>
          <span className="text-[10px] font-bold text-stone-400">{counts.active} active</span>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {CHIPS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={cn("shrink-0 touch-manipulation rounded-full px-3 py-1.5 text-[11px] font-bold transition",
                filter === f.key ? "bg-brand-orange text-white" : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400")}>
              {f.label}{counts[f.key] ? ` ${counts[f.key]}` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Order List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {visible.length === 0 && (
          <div className="text-center py-8">
            <p className="text-2xl mb-1">{filter === "active" ? "✅" : "📋"}</p>
            <p className="text-xs text-stone-400">{filter === "active" ? "All caught up" : "No orders"}</p>
          </div>
        )}
        {visible.map((o) => {
          const next = nextCounterAction(o.status, o.type);
          const unpaid = o.payment_status !== "paid";
          const takePayment = next?.status === "delivered" && unpaid;
          const note = kitchenNote(o);
          const phone = customerPhone(o);
          const expanded = expandedId === o.id;
          const busy = busyId === o.id;
          return (
            <div key={o.id} className={cn("rounded-xl border p-3 transition-all",
              o.status === "pending" ? "border-amber-300 bg-amber-50/60 ring-1 ring-amber-200 dark:border-amber-600/60 dark:bg-amber-950/30 dark:ring-amber-900/60"
                : o.status === "ready" ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/30" : "border-stone-100 dark:border-stone-800",
              CLOSED.includes(o.status) && lingering.includes(o.id) && "opacity-50")}>
              <button type="button" onClick={() => setExpandedId(expanded ? null : o.id)} className="block w-full touch-manipulation text-left">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="font-mono text-2xl font-extrabold leading-none text-brand-brown dark:text-orange-100">
                      #{o.daily_number != null ? String(o.daily_number).padStart(2, "0") : "—"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-stone-800 dark:text-stone-100">{customerName(o)}</p>
                      <p className="text-[10px] text-stone-400" suppressHydrationWarning>
                        {o.type === "dine_in" ? "Dine-in" : o.type === "delivery" ? "🛵 Delivery" : "Pickup"}
                        {" · "}{formatDistanceToNowStrict(new Date(o.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_COLORS[o.status] ?? "bg-stone-100")}>
                    {orderStatusLabel(o.status, o.type)}
                  </span>
                </div>
                {o.items && o.items.length > 0 && (
                  <p className="mt-2 text-sm font-bold leading-snug text-stone-800 dark:text-stone-100">
                    {o.items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ")}
                  </p>
                )}
                {note && <p className="mt-1.5 rounded-lg bg-yellow-50 px-2 py-1 text-xs font-bold text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200">📝 {note}</p>}
              </button>

              <div className="mt-2.5 flex items-center gap-2">
                <span className={cn("shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold",
                  unpaid ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400")}>
                  {unpaid ? `${npr(Number(o.total))} due` : `✓ ${npr(Number(o.total))}`}
                </span>
                {o.discount_label && (
                  <span className="shrink-0 rounded-lg bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300" title={`Discount: ${o.discount_label}`}>
                    {o.discount_label === MEMBER_PRICE_LABEL ? "👑" : "🎓"}
                  </span>
                )}
                {next && (
                  <button disabled={busy}
                    onClick={() => (takePayment ? payAndHandOver(o, next.status) : move(o, next.status))}
                    className={cn("flex-1 touch-manipulation rounded-xl py-3 text-sm font-extrabold text-white transition active:scale-[0.97] disabled:opacity-60",
                      next.status === "confirmed" ? "bg-brand-orange" : next.status === "ready" ? "bg-blue-600" : "bg-brand-green")}>
                    {takePayment ? `Paid · ${next.label}` : next.label}
                  </button>
                )}
              </div>

              {/* Details + less common actions */}
              {expanded && (
                <div className="mt-3 space-y-2 border-t border-stone-100 pt-2 dark:border-stone-800">
                  <p className="text-[10px] text-stone-400" suppressHydrationWarning>
                    {o.order_number} · {format(new Date(o.created_at), "d MMM, h:mm a")}
                    {o.payment_method ? ` · ${o.payment_method.toUpperCase()}` : ""}
                  </p>
                  {phone && (
                    <a href={`tel:${phone}`} className="inline-block text-xs font-bold text-brand-orange">📞 {phone}</a>
                  )}
                  {o.type === "delivery" && noteField(o.notes, "Address") && (
                    <p className="text-[11px] font-bold text-stone-600 bg-stone-50 p-1.5 rounded dark:bg-stone-800 dark:text-stone-300">📍 {noteField(o.notes, "Address")}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {unpaid && !takePayment && o.status !== "cancelled" && (
                      <button disabled={busy} onClick={() => markPaid(o)} className="touch-manipulation rounded-lg bg-green-600 text-white px-3 py-2 text-[11px] font-bold hover:brightness-110 transition">
                        Mark paid
                      </button>
                    )}
                    {!CLOSED.includes(o.status) && (
                      <button disabled={busy} onClick={() => cancel(o)} className="touch-manipulation rounded-lg bg-red-100 text-red-600 px-3 py-2 text-[11px] font-bold hover:bg-red-200 transition dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/50">
                        Cancel order
                      </button>
                    )}
                  </div>

                  {/* Driver Assignment */}
                  {o.type === "delivery" && o.status === "ready" && (
                    <div className="mt-2">
                      <p className="text-[10px] font-bold text-stone-500 mb-1">Assign Driver:</p>
                      <div className="flex flex-wrap gap-1">
                        {drivers.filter((d) => d.is_online).map((d) => (
                          <button key={d.id} onClick={() => handleAssignDriver(o.id, d.id)} className="touch-manipulation rounded-lg bg-cyan-50 text-cyan-700 px-2.5 py-1.5 text-[10px] font-bold hover:bg-cyan-100 transition border border-cyan-200">
                            {d.full_name}
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
          );
        })}
      </div>
    </div>
  );
}
