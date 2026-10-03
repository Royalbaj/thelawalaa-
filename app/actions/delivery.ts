"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { hashOtp } from "@/lib/delivery-otp";
import { noteField } from "@/lib/order-notes";

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

export async function verifyDeliveryOtp(orderId: string, otp: string) {
  const { user } = await requireRole(["delivery_driver"]);
  if (!/^\d{2}$/.test(otp)) return { error: "The code is 2 digits" };

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
    .update({ otp_verified: true, delivered_at: now })
    .eq("id", delivery.id);
  await supabaseAdmin.from("orders").update({ status: "delivered" }).eq("id", orderId);

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
