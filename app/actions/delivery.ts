"use server";

import crypto from "crypto";
import { z } from "zod";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { hashOtp } from "@/lib/delivery-otp";
import { noteField } from "@/lib/order-notes";
import { measureDelivery } from "@/lib/rider-trips";

export async function setDriverOnline(online: boolean) {
  const { user } = await requireRole(["delivery_driver"]);
  await supabaseAdmin
    .from("profiles")
    .update({ is_online: !!online, last_seen_at: new Date().toISOString() })
    .eq("id", user.id);
  await audit({ actor_id: user.id, action: online ? "DRIVER_ONLINE" : "DRIVER_OFFLINE", target_table: "profiles", target_id: user.id });
  revalidatePath("/delivery");
  return { ok: true };
}

// Legal transitions only — a driver can't jump straight to "delivered"
// and can only ever touch deliveries assigned to them.
const DRIVER_TRANSITIONS: Record<string, { next: string; stamp: string }> = {
  assigned: { next: "picked_up", stamp: "picked_up_at" },
  picked_up: { next: "on_the_way", stamp: "on_the_way_at" },
};

export async function driverAdvanceStatus(orderId: string) {
  const { user } = await requireRole(["delivery_driver"]);

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, status, deliveries!inner(driver_id)")
    .eq("id", orderId)
    .single();

  if (!order || (order.deliveries as unknown as { driver_id: string } | null)?.driver_id !== user.id) {
    return { error: "Not your delivery" };
  }
  const t = DRIVER_TRANSITIONS[order.status];
  if (!t) return { error: "This order can't be moved on from here" };

  await supabaseAdmin.from("orders").update({ status: t.next }).eq("id", orderId);
  await supabaseAdmin
    .from("deliveries")
    .update({ [t.stamp]: new Date().toISOString() })
    .eq("order_id", orderId);

  await audit({ actor_id: user.id, action: "DRIVER_STATUS", target_table: "orders", target_id: orderId, new_data: { status: t.next } });
  revalidatePath("/delivery");
  return { ok: true, status: t.next };
}

const MAX_OTP_ATTEMPTS = 3;

// Where the rider's phone was when they tapped Delivered — for the fuel report (migration 045).
const dropSchema = z.object({
  lat: z.number().min(26.3).max(30.5), lng: z.number().min(80).max(88.3), accuracy: z.number().min(0).max(100000).optional(),
}).optional();

export async function verifyDeliveryOtp(orderId: string, otp: string, drop?: unknown) {
  const { user } = await requireRole(["delivery_driver"]);
  if (!/^\d{2}$/.test(otp)) return { error: "The code is 2 digits" };
  const spot = dropSchema.safeParse(drop).data; // no GPS (or outside Nepal) = not recorded

  const { data: delivery } = await supabaseAdmin
    .from("deliveries")
    .select("id, driver_id, delivery_otp_hash, otp_attempts, otp_verified")
    .eq("order_id", orderId)
    .single();

  if (!delivery || delivery.driver_id !== user.id) return { error: "Not your delivery" };
  if (delivery.otp_verified) return { ok: true };
  if (delivery.otp_attempts >= MAX_OTP_ATTEMPTS) {
    return { error: "Too many wrong codes — call the shop so they can confirm this delivery" };
  }

  const expected = delivery.delivery_otp_hash ?? "";
  const candidate = hashOtp(otp, orderId);
  const ok =
    expected.length === candidate.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(candidate));

  if (!ok) {
    await supabaseAdmin
      .from("deliveries")
      .update({ otp_attempts: delivery.otp_attempts + 1 })
      .eq("id", delivery.id);
    const left = MAX_OTP_ATTEMPTS - delivery.otp_attempts - 1;
    return { error: left > 0 ? `Wrong code — ${left} ${left === 1 ? "try" : "tries"} left` : "Wrong code — call the shop so they can confirm this delivery" };
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from("deliveries")
    .update({
      otp_verified: true, delivered_at: now,
      ...(spot ? { drop_lat: spot.lat, drop_lng: spot.lng, drop_accuracy_m: spot.accuracy != null ? Math.round(spot.accuracy) : null } : {}),
    })
    .eq("id", delivery.id);
  await supabaseAdmin.from("orders").update({ status: "delivered" }).eq("id", orderId);
  // Road distance from the shop (Google Maps) — after the answer, so the rider never waits on it.
  after(() => measureDelivery(orderId));

  await audit({ actor_id: user.id, action: "DELIVERY_CONFIRMED", target_table: "deliveries", target_id: delivery.id });
  revalidatePath("/delivery");
  return { ok: true };
}

/**
 * Customer phone never appears in driver-side HTML. The driver taps
 * "Call" and this returns a tel: URI on demand — only while the
 * delivery is theirs and still active. Works for guest orders too
 * (their number is in the order, not a profile).
 */
export async function getCustomerTelLink(orderId: string) {
  const { user } = await requireRole(["delivery_driver"]);

  const { data } = await supabaseAdmin
    .from("orders")
    .select("status, customer_id, notes, deliveries!inner(driver_id)")
    .eq("id", orderId)
    .single();

  if (!data || (data.deliveries as unknown as { driver_id: string } | null)?.driver_id !== user.id) return { error: "Not your delivery" };
  if (["delivered", "cancelled"].includes(data.status)) return { error: "This delivery is closed" };

  let phone = noteField(data.notes, "Phone");
  if (!phone && data.customer_id) {
    const { data: customer } = await supabaseAdmin.from("profiles").select("phone").eq("id", data.customer_id).single();
    phone = customer?.phone ?? null;
  }
  if (!phone) return { error: "No phone number on this order — call the shop" };
  await audit({ actor_id: user.id, action: "DRIVER_FETCH_PHONE", target_table: "orders", target_id: orderId });
  return { tel: `tel:${phone.replace(/[^\d+]/g, "")}` };
}

/**
 * Admin → Deliveries: work the distance out again for trips that only have a
 * straight line (Google couldn't be asked at the time) or none yet — e.g. once
 * a Google Maps key with the Routes API is set. At most 60 per tap.
 */
export async function recalcTripDistances(input: unknown) {
  await requireRole(["super_admin"]);
  const r = z.object({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }) }).safeParse(input);
  if (!r.success) return { error: "Bad period" };
  const { data } = await supabaseAdmin.from("deliveries").select("order_id, distance_source")
    .not("delivered_at", "is", null).gte("delivered_at", r.data.from).lt("delivered_at", r.data.to)
    .or("distance_source.is.null,distance_source.eq.straight").limit(60);
  if (!data?.length) return { ok: true, checked: 0, road: 0 };
  for (const d of data) await measureDelivery(d.order_id);
  const { count: road } = await supabaseAdmin.from("deliveries").select("id", { count: "exact", head: true })
    .in("order_id", data.map((d) => d.order_id)).eq("distance_source", "road");
  revalidatePath("/admin/delivery");
  return { ok: true, checked: data.length, road: road ?? 0 };
}
