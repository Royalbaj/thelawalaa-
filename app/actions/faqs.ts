"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";

const faqSchema = z.object({
  question: z.string().trim().min(4).max(200),
  answer: z.string().trim().min(4).max(1000),
});

export async function addFaq(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = faqSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form fields" };

  const { data, error } = await supabaseAdmin.from("faqs").insert(parsed.data).select("id").single();
  if (error) return { error: "Could not add FAQ" };

  await audit({ actor_id: user.id, action: "ADD_FAQ", target_table: "faqs", target_id: data.id, new_data: parsed.data });
  revalidatePath("/admin/faqs");
  revalidatePath("/");
  return { ok: true };
}

export async function updateFaq(id: string, input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad id" };
  const parsed = faqSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form fields" };

  const { error } = await supabaseAdmin.from("faqs").update(parsed.data).eq("id", id);
  if (error) return { error: "Could not update FAQ" };

  await audit({ actor_id: user.id, action: "UPDATE_FAQ", target_table: "faqs", target_id: id, new_data: parsed.data });
  revalidatePath("/admin/faqs");
  revalidatePath("/");
  return { ok: true };
}

export async function setFaqActive(id: string, active: boolean) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad id" };
  await supabaseAdmin.from("faqs").update({ is_active: active }).eq("id", id);
  await audit({ actor_id: user.id, action: "TOGGLE_FAQ", target_table: "faqs", target_id: id, new_data: { active } });
  revalidatePath("/admin/faqs");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteFaq(id: string) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad id" };
  await supabaseAdmin.from("faqs").delete().eq("id", id);
  await audit({ actor_id: user.id, action: "DELETE_FAQ", target_table: "faqs", target_id: id });
  revalidatePath("/admin/faqs");
  revalidatePath("/");
  return { ok: true };
}
