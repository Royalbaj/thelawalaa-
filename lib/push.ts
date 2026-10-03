// Web Push to staff devices — the POS iPad gets a notification (with the
// system sound) for every new online order, even with the POS closed, and a
// rider's phone gets one for each delivery assigned to them.
// iOS only allows this for a web app added to the Home Screen; see
// components/pos/order-alerts.tsx for the device side.
import "server-only";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/admin";

const STAFF_ROLES = ["pos_user", "super_admin"];
let configured: boolean | undefined;

function ready() {
  if (configured !== undefined) return configured;
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:hello@thelawalaa.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
      process.env.VAPID_PRIVATE_KEY ?? "",
    );
    configured = true;
  } catch (e) {
    console.error("Web Push is not configured (VAPID keys):", (e as Error).message);
    configured = false;
  }
  return configured;
}

export type PushMessage = { title: string; body: string; tag: string; url: string };

/** Send to every active device of these roles that turned alerts on (or just one profile's). Dead devices are forgotten. */
async function pushToRoles(roles: string[], message: PushMessage, onlyProfileId?: string) {
  if (!ready()) return { sent: 0, configured: false };
  let query = supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, profile:profiles!push_subscriptions_customer_id_fkey(role, is_active)");
  if (onlyProfileId) query = query.eq("customer_id", onlyProfileId);
  const { data: subs } = await query;

  const targets = (subs ?? []).filter((s) => {
    const p = s.profile as unknown as { role: string; is_active: boolean } | null;
    return p?.is_active && roles.includes(p.role);
  });
  const payload = JSON.stringify(message);
  const results = await Promise.allSettled(targets.map((s) =>
    webpush
      .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 15 * 60, urgency: "high" })
      .catch(async (e: { statusCode?: number }) => {
        // 404/410: the device unsubscribed or the app was removed — stop sending to it.
        if (e.statusCode === 404 || e.statusCode === 410) await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("Web Push send failed:", e.statusCode);
        throw e;
      })));
  return { sent: results.filter((r) => r.status === "fulfilled").length, configured: true };
}

/** The counter devices (POS / admin) — new online orders, stock alerts. */
export const pushToStaff = (message: PushMessage, onlyProfileId?: string) => pushToRoles(STAFF_ROLES, message, onlyProfileId);

/** Delivery riders' phones — a new delivery for them, or a message from the admin. */
export const pushToDrivers = (message: PushMessage, onlyProfileId?: string) => pushToRoles(["delivery_driver"], message, onlyProfileId);
