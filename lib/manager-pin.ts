import "server-only";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { isPin, verifyPin } from "@/lib/accounts-pin";
import { cleanFeatures } from "@/lib/pos-features";

// The POS manager discount is approved with a manager's OWN PIN — a staff
// person whose POS role has "Approve manager discount" (pos_roles, migration
// 051; before that training_people.is_manager). Checked when the button is pressed AND again when the order is placed;
// the screen is never trusted. 5 wrong tries in 15 minutes on a login locks it.

export async function managerForPin(pin: unknown, actorId: string): Promise<{ manager: { id: string; name: string } } | { error: string }> {
  if (!isPin(pin)) return { error: "Enter the manager's 4-digit PIN" };
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await supabaseAdmin.from("audit_logs").select("id", { count: "exact", head: true })
    .eq("action", "MANAGER_PIN_FAIL").eq("actor_id", actorId).gte("created_at", since);
  if ((count ?? 0) >= 5) return { error: "Too many wrong PINs — wait 15 minutes" };

  const { data: people } = await supabaseAdmin.from("training_people").select("id, name, pin_hash, role:pos_roles(features)").eq("is_active", true);
  for (const p of people ?? []) {
    if (!(await verifyPin(pin, p.pin_hash))) continue;
    if (approves(p.role)) return { manager: { id: p.id, name: p.name } };
    break; // a real PIN, but not a manager's
  }
  await audit({ actor_id: actorId, action: "MANAGER_PIN_FAIL", target_table: "training_people" });
  return { error: "That isn't a manager's PIN" };
}

/** Does this role (an embedded pos_roles row) approve the manager discount? */
const approves = (role: unknown) =>
  cleanFeatures((role as { features?: string[] } | null)?.features).includes("manager_discount");

/** Is anyone able to approve it? The POS shows the Manager button only then. */
export async function hasManager() {
  const { data } = await supabaseAdmin.from("training_people").select("id, role:pos_roles(features)").eq("is_active", true);
  return (data ?? []).some((p) => approves(p.role));
}
