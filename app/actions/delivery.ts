"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";

function hashOtp(otp: string, orderId: string) {
  return crypto
    .createHmac("sha256", process.env.OTP_HMAC_SECRET!)
    .update(`${orderId}:${otp}`)
    .digest("hex");
}

export async function setDriverOnline(online: boolean) {
  const { user } = await requireRole(["delivery_driver"]);
  await supabaseAdmin
    .from("profiles")
    .update({ is_online: online, last_seen_at: new Date().toISOString() })
    .eq("id", user.id);
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

  if (!order || (order.deliveries as any)?.driver_id !== user.id) {
    return { error: "Not your delivery" };
  }
  const t = DRIVER_TRANSITIONS[order.status];
  if (!t) return { error: "This order can't be advanced from here" };

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
  if (!/^\d{4}$/.test(otp)) return { error: "OTP is 4 digits" };

  const { data: delivery } = await supabaseAdmin
    .from("deliveries")
    .select("id, driver_id, delivery_otp_hash, otp_attempts, otp_verified")
    .eq("order_id", orderId)
    .single();

  if (!delivery || delivery.driver_id !== user.id) return { error: "Not your delivery" };
  if (delivery.otp_verified) return { ok: true };
  if (delivery.otp_attempts >= MAX_OTP_ATTEMPTS) {
    return { error: "Too many wrong attempts — ask support to confirm this delivery" };
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
    return { error: `Wrong OTP (${MAX_OTP_ATTEMPTS - delivery.otp_attempts - 1} attempts left)` };
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
 * delivery is theirs and still active.
 */
export async function getCustomerTelLink(orderId: string) {
  const { user } = await requireRole(["delivery_driver"]);

  const { data } = await supabaseAdmin
    .from("orders")
    .select("status, customer_id, deliveries!inner(driver_id)")
    .eq("id", orderId)
    .single();

  if (!data || (data.deliveries as any)?.driver_id !== user.id) return { error: "Not your delivery" };
  if (["delivered", "cancelled"].includes(data.status)) return { error: "Delivery is closed" };

  const { data: customer } = await supabaseAdmin
    .from("profiles")
    .select("phone")
    .eq("id", data.customer_id)
    .single();

  if (!customer?.phone) return { error: "No phone on file" };
  await audit({ actor_id: user.id, action: "DRIVER_FETCH_PHONE", target_table: "orders", target_id: orderId });
  return { tel: `tel:${customer.phone}` };
}
