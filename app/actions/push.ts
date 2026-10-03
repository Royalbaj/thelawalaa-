"use server";

import { z } from "zod";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { pushToStaff, pushToDrivers } from "@/lib/push";

// Only real browser push services — the server POSTs to this URL, so it must
// never be an arbitrary address.
const PUSH_SERVICE = /^https:\/\/([a-z0-9-]+\.)*(push\.apple\.com|googleapis\.com|mozilla\.com|notify\.windows\.com)\//i;

const subscriptionSchema = z.object({
  endpoint: z.string().max(2000).regex(PUSH_SERVICE),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** This POS device wants a notification for every new online order (a rider's phone: for each delivery given to them). */
export async function saveStaffPushSubscription(input: unknown) {
  const { user } = await requireRole(["pos_user", "super_admin", "delivery_driver"]);
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { error: "This browser's alert details look wrong — try again" };
  const { endpoint, keys } = parsed.data;
  const { error } = await supabaseAdmin
    .from("push_subscriptions")
    .upsert({ customer_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: "endpoint" });
  if (error) return { error: "Couldn't turn alerts on — try again" };
  return { ok: true };
}

/** "Send test alert" — only to the signed-in user's own devices. */
export async function sendTestPush() {
  const { user, profile } = await requireRole(["pos_user", "super_admin", "delivery_driver"]);
  const r = profile.role === "delivery_driver"
    ? await pushToDrivers({ title: "Thelawalaa Driver", body: "Test alert — new deliveries will look like this.", tag: "test", url: "/delivery" }, user.id)
    : await pushToStaff({ title: "Thelawalaa POS", body: "Test alert — online orders will look like this.", tag: "test", url: "/admin" }, user.id);
  if (!r.configured) return { error: "Alerts aren't set up on the server (VAPID keys missing)" };
  if (!r.sent) return { error: "No device received it — turn alerts on again on this device" };
  return { ok: true, sent: r.sent };
}
