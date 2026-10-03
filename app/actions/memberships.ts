"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { newMemberSchema } from "@/lib/validations/order";

// Admin → Members: fix a typo in what was taken at the counter, or remove an entry.

export async function updateMembership(id: string, input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad member" };
  const parsed = newMemberSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details" };
  const { full_name, phone, card_number } = parsed.data;
  const { error } = await supabaseAdmin.from("memberships").update({ full_name, phone, card_number: card_number ?? null }).eq("id", id);
  if (error) return { error: "Couldn't save" };
  await audit({ actor_id: user.id, action: "MEMBERSHIP_EDIT", target_table: "memberships", target_id: id, new_data: parsed.data });
  revalidatePath("/admin/members");
  return { ok: true };
}

export async function deleteMembership(id: string) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad member" };
  const { error } = await supabaseAdmin.from("memberships").delete().eq("id", id);
  if (error) return { error: "Couldn't remove it" };
  await audit({ actor_id: user.id, action: "MEMBERSHIP_DELETE", target_table: "memberships", target_id: id });
  revalidatePath("/admin/members");
  return { ok: true };
}
