// ⚠️ SERVICE ROLE CLIENT — bypasses RLS entirely.
// Import ONLY from server actions / route handlers, never client components.
// "server-only" makes the build FAIL if this leaks into client code.
import "server-only";
import { normaliseRewards } from "@/lib/rewards";
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

// ── Rewards (migration 027) ──────────────────────────────────────
// Balances only ever change inside the loyalty_* SQL functions, which are
// keyed on the order (retries and double clicks can't pay out twice).

/** An order became paid: its points + one stamp towards the free item. */
export async function loyaltyAward(orderId: string) {
  const { error } = await supabaseAdmin.rpc("loyalty_award", { p_order: orderId });
  if (error) console.error("loyalty_award failed:", error.message);
}
/** "Paid" was undone (mis-click): take back what that order earned. */
export async function loyaltyUnaward(orderId: string) {
  const { error } = await supabaseAdmin.rpc("loyalty_unaward", { p_order: orderId });
  if (error) console.error("loyalty_unaward failed:", error.message);
}
/** Cancelled: give back the points / free item it used, and undo what it earned. */
export async function loyaltyOnCancel(orderId: string) {
  const { error } = await supabaseAdmin.rpc("loyalty_on_cancel", { p_order: orderId });
  if (error) console.error("loyalty_on_cancel failed:", error.message);
}

export async function getRewardSettings() {
  const { data } = await supabaseAdmin.from("reward_settings").select("*").eq("id", 1).maybeSingle();
  return normaliseRewards(data);
}

/**
 * Branch a staff-placed order belongs to. The operator's own profile wins;
 * without one (admins, or a POS account nobody assigned) a single-branch
 * business has nothing to choose, so use its only active branch. With
 * several branches this stays null and an admin must assign one.
 */
export async function resolveStaffBranchId(ownBranchId: string | null): Promise<string | null> {
  if (ownBranchId) return ownBranchId;
  const { data } = await supabaseAdmin.from("branches").select("id").eq("is_active", true).limit(2);
  return data?.length === 1 ? data[0].id : null;
}
