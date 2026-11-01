"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { POS_FEATURE_KEYS, type PosFeature } from "@/lib/pos-features";

// Admin → POS team & roles (migration 051): named roles with the extra POS
// features they allow, and which role each counter person has. Selling is never
// gated; a person without a role keeps DEFAULT_FEATURES.

const uuid = z.string().uuid();
const roleSchema = z.object({
  name: z.string().trim().min(1, "Give the role a name").max(40, "Keep the name under 40 characters"),
  features: z.array(z.enum(POS_FEATURE_KEYS as [PosFeature, ...PosFeature[]])).max(20),
});

function refresh() {
  revalidatePath("/admin/pos-team");
  revalidatePath("/admin/hours");
  revalidatePath("/admin"); // the POS: its buttons follow the role
}

export async function createRole(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the role" };
  const { data: last } = await supabaseAdmin.from("pos_roles").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabaseAdmin.from("pos_roles")
    .insert({ name: parsed.data.name, features: [...new Set(parsed.data.features)], sort_order: (last?.sort_order ?? 0) + 1 }).select("id").single();
  if (error || !data) return { error: error?.code === "23505" ? "There's already a role with that name" : "Couldn't add the role" };
  await audit({ actor_id: user.id, action: "POS_ROLE_ADD", target_table: "pos_roles", target_id: data.id, new_data: parsed.data });
  refresh();
  return { ok: true };
}

export async function updateRole(id: string, input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  if (!uuid.safeParse(id).success) return { error: "Bad role" };
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the role" };
  const { data: old } = await supabaseAdmin.from("pos_roles").select("name, features").eq("id", id).maybeSingle();
  if (!old) return { error: "That role is gone — refresh" };
  const { error } = await supabaseAdmin.from("pos_roles")
    .update({ name: parsed.data.name, features: [...new Set(parsed.data.features)], updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: error.code === "23505" ? "There's already a role with that name" : "Couldn't save the role" };
  await audit({ actor_id: user.id, action: "POS_ROLE_EDIT", target_table: "pos_roles", target_id: id, old_data: old, new_data: parsed.data });
  refresh();
  return { ok: true };
}

/** People with this role keep only the basic abilities (Counter staff's) until they get another. */
export async function deleteRole(id: string) {
  const { user } = await requireRole(["super_admin"]);
  if (!uuid.safeParse(id).success) return { error: "Bad role" };
  const { data: old } = await supabaseAdmin.from("pos_roles").select("name, features").eq("id", id).maybeSingle();
  if (!old) return { ok: true };
  const { error } = await supabaseAdmin.from("pos_roles").delete().eq("id", id);
  if (error) return { error: "Couldn't delete the role" };
  await audit({ actor_id: user.id, action: "POS_ROLE_DELETE", target_table: "pos_roles", target_id: id, old_data: old });
  refresh();
  return { ok: true };
}

export async function setPersonRole(personId: string, roleId: string | null) {
  const { user } = await requireRole(["super_admin"]);
  if (!uuid.safeParse(personId).success || (roleId !== null && !uuid.safeParse(roleId).success)) return { error: "Bad choice" };
  const { data: p } = await supabaseAdmin.from("training_people").select("name, role_id").eq("id", personId).maybeSingle();
  if (!p) return { error: "That person is gone — refresh" };
  if (roleId) {
    const { data: r } = await supabaseAdmin.from("pos_roles").select("id").eq("id", roleId).maybeSingle();
    if (!r) return { error: "That role is gone — refresh" };
  }
  const { error } = await supabaseAdmin.from("training_people").update({ role_id: roleId, updated_at: new Date().toISOString() }).eq("id", personId);
  if (error) return { error: "Couldn't save" };
  await audit({ actor_id: user.id, action: "POS_PERSON_ROLE", target_table: "training_people", target_id: personId, old_data: { role_id: p.role_id }, new_data: { role_id: roleId, person: p.name } });
  refresh();
  return { ok: true };
}
