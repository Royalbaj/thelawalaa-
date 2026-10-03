import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { noteField, customerNote } from "@/lib/order-notes";

// What a rider's screens get about their deliveries — only what the job
// needs. Never the customer's phone (the Call button fetches it on demand,
// lib: getCustomerTelLink) and never money once a delivery is done: an
// active one shows what to collect, history shows no amounts at all.

export type DriverJob = {
  orderId: string;
  orderNumber: string;
  dailyNumber: number | null;
  status: string;
  firstName: string;
  address: string | null;
  pin: { lat: number; lng: number; accuracy: number | null } | null;
  items: { name: string; qty: number }[];
  /** Rupees to collect at the door; null when it's already paid. */
  collect: number | null;
  paymentMethod: string | null;
  note: string | null;
  assignedAt: string | null;
  otpAttemptsLeft: number;
};

export type DriverDone = {
  orderNumber: string;
  deliveredAt: string | null;
  minutes: number | null;
  itemCount: number;
  area: string | null;
};

const SELECT = `id, assigned_at, picked_up_at, on_the_way_at, delivered_at, otp_verified, otp_attempts,
  orders!inner(id, order_number, daily_number, status, total, payment_status, payment_method, notes,
    delivery_address, delivery_lat, delivery_lng, delivery_accuracy_m, items:order_items(product_name, quantity))`;

type Row = {
  id: string; assigned_at: string | null; picked_up_at: string | null; on_the_way_at: string | null; delivered_at: string | null;
  otp_verified: boolean; otp_attempts: number;
  orders: {
    id: string; order_number: string; daily_number: number | null; status: string; total: number; payment_status: string; payment_method: string | null;
    notes: string | null; delivery_address: string | null; delivery_lat: number | null; delivery_lng: number | null; delivery_accuracy_m: number | null;
    items: { product_name: string; quantity: number }[];
  };
};

const ACTIVE = ["assigned", "picked_up", "on_the_way"];

export async function getDriverJobs(driverId: string) {
  const { data } = await supabaseAdmin.from("deliveries").select(SELECT)
    .eq("driver_id", driverId).in("orders.status", ACTIVE)
    .order("assigned_at", { ascending: true }).limit(20);
  return ((data ?? []) as unknown as Row[]).map((d): DriverJob => {
    const o = d.orders;
    return {
      orderId: o.id,
      orderNumber: o.order_number,
      dailyNumber: o.daily_number,
      status: o.status,
      firstName: (noteField(o.notes, "Name") ?? "Customer").split(/\s+/)[0],
      address: o.delivery_address ?? noteField(o.notes, "Address"),
      pin: o.delivery_lat != null && o.delivery_lng != null ? { lat: o.delivery_lat, lng: o.delivery_lng, accuracy: o.delivery_accuracy_m } : null,
      items: (o.items ?? []).map((i) => ({ name: i.product_name, qty: i.quantity })),
      collect: o.payment_status === "paid" ? null : Number(o.total),
      paymentMethod: o.payment_method,
      note: customerNote(o.notes),
      assignedAt: d.assigned_at,
      otpAttemptsLeft: Math.max(0, 3 - (d.otp_attempts ?? 0)),
    };
  });
}

export async function getDriverHistory(driverId: string, limit = 60) {
  const { data } = await supabaseAdmin.from("deliveries").select(SELECT)
    .eq("driver_id", driverId).eq("orders.status", "delivered")
    .order("delivered_at", { ascending: false, nullsFirst: false }).limit(limit);
  return ((data ?? []) as unknown as Row[]).map((d): DriverDone => {
    const start = d.picked_up_at ?? d.assigned_at;
    const minutes = start && d.delivered_at ? Math.max(1, Math.round((new Date(d.delivered_at).getTime() - new Date(start).getTime()) / 60000)) : null;
    const address = d.orders.delivery_address ?? noteField(d.orders.notes, "Address");
    return {
      orderNumber: d.orders.order_number,
      deliveredAt: d.delivered_at,
      minutes,
      itemCount: (d.orders.items ?? []).reduce((n, i) => n + i.quantity, 0),
      // Just the area (the part before the first comma) — not the customer's full address.
      area: address ? address.split(",")[0].slice(0, 40) : null,
    };
  });
}

/** Deliveries finished today (Nepal day, from todayStartIso) and ever — counts only, no amounts. */
export async function getDriverCounts(driverId: string, todayStartIso: string) {
  const done = () => supabaseAdmin.from("deliveries").select("id, orders!inner(status, served_at)", { count: "exact", head: true })
    .eq("driver_id", driverId).eq("orders.status", "delivered");
  const [{ count: total }, { count: today }] = await Promise.all([done(), done().gte("orders.served_at", todayStartIso)]);
  return { total: total ?? 0, today: today ?? 0 };
}
