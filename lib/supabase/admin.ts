// ⚠️ SERVICE ROLE CLIENT — bypasses RLS entirely.
// Import ONLY from server actions / route handlers, never client components.
// "server-only" makes the build FAIL if this leaks into client code.
import "server-only";
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/** Append-only audit trail. Never exposed to any client. */
export async function audit(entry: {
  actor_id: string | null;
  action: string;
  target_table?: string;
  target_id?: string | null;
  old_data?: unknown;
  new_data?: unknown;
}) {
  await supabaseAdmin.from("audit_logs").insert(entry as never);
}

const LOYALTY_TIERS = [
  { name: "bronze", min: 0 },
  { name: "silver", min: 500 },
  { name: "gold", min: 2000 },
  { name: "platinum", min: 5000 },
] as const;

/**
 * 1 point per Rs 10 on a completed order — the Rewards page advertises
 * this, but nothing ever actually granted it. Call once, exactly when
 * payment_status flips to 'paid' (both markOrderPaid and the eSewa
 * callback already guard against re-processing an already-paid order,
 * so this is safe to call unconditionally from either).
 */
export async function awardOrderLoyaltyPoints(customerId: string | null, orderTotal: number) {
  if (!customerId) return; // guest/POS orders have no persistent identity to credit
  const points = Math.floor(orderTotal / 10);
  if (points <= 0) return;

  const { data: existing } = await supabaseAdmin
    .from("loyalty_points").select("points, total_earned").eq("customer_id", customerId).maybeSingle();
  const newPoints = (existing?.points ?? 0) + points;
  const newTotalEarned = (existing?.total_earned ?? 0) + points;
  const tier = [...LOYALTY_TIERS].reverse().find((t) => newTotalEarned >= t.min)!.name;

  if (existing) {
    await supabaseAdmin.from("loyalty_points")
      .update({ points: newPoints, total_earned: newTotalEarned, tier }).eq("customer_id", customerId);
  } else {
    await supabaseAdmin.from("loyalty_points")
      .insert({ customer_id: customerId, points: newPoints, total_earned: newTotalEarned, tier });
  }
  await supabaseAdmin.from("loyalty_transactions")
    .insert({ customer_id: customerId, points_change: points, reason: "order_reward" });
}
