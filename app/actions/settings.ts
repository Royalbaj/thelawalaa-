"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";

const schema = z.object({ esewa_enabled: z.boolean(), delivery_enabled: z.boolean() });

/** Site-wide feature flags — admin only, see app_settings migration. */
export async function updateAppSettings(input: unknown) {
  const { user } = await requireRole(["admin"]);
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid settings" };

  const { error } = await supabaseAdmin
    .from("app_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { error: "Could not update settings" };

  await audit({ actor_id: user.id, action: "UPDATE_APP_SETTINGS", target_table: "app_settings", target_id: "1", new_data: parsed.data });
  revalidatePath("/admin/settings");
  revalidatePath("/order");
  revalidatePath("/");
  return { ok: true };
}

export async function getAppSettings() {
  const { data } = await supabaseAdmin.from("app_settings").select("esewa_enabled, delivery_enabled").eq("id", 1).single();
  return data ?? { esewa_enabled: false, delivery_enabled: false };
}

// ── Opening-day promo (e.g. "Momo @ Rs 11/plate") ───────────────────
const openingPromoSchema = z.object({
  opening_promo_enabled: z.boolean(),
  opening_promo_momo_price: z.coerce.number().positive().max(10000),
  opening_promo_starts_at: z.string().optional().or(z.literal("")),
  opening_promo_ends_at: z.string().optional().or(z.literal("")),
});

export async function updateOpeningPromo(input: unknown) {
  const { user } = await requireRole(["admin"]);
  const parsed = openingPromoSchema.safeParse(input);
  if (!parsed.success) return { error: "Check the promo fields" };

  const { error } = await supabaseAdmin
    .from("app_settings")
    .update({
      opening_promo_enabled: parsed.data.opening_promo_enabled,
      opening_promo_momo_price: parsed.data.opening_promo_momo_price,
      opening_promo_starts_at: parsed.data.opening_promo_starts_at ? new Date(parsed.data.opening_promo_starts_at).toISOString() : null,
      opening_promo_ends_at: parsed.data.opening_promo_ends_at ? new Date(parsed.data.opening_promo_ends_at).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { error: "Could not update promo" };

  await audit({ actor_id: user.id, action: "UPDATE_OPENING_PROMO", target_table: "app_settings", target_id: "1", new_data: parsed.data });
  revalidatePath("/admin/settings");
  revalidatePath("/order");
  revalidatePath("/pos");
  revalidatePath("/admin");
  return { ok: true };
}

// ── Social links ──────────────────────────────────────────────────
const socialLinkSchema = z.object({
  platform: z.string().trim().min(2).max(30),
  url: z.string().trim().url().max(300),
});

export async function addSocialLink(input: unknown) {
  const { user } = await requireRole(["admin"]);
  const parsed = socialLinkSchema.safeParse(input);
  if (!parsed.success) return { error: "Enter a platform name and a valid URL" };

  const { data, error } = await supabaseAdmin.from("social_links").insert(parsed.data).select("id").single();
  if (error) return { error: "Could not add link" };

  await audit({ actor_id: user.id, action: "ADD_SOCIAL_LINK", target_table: "social_links", target_id: data.id, new_data: parsed.data });
  revalidatePath("/admin/settings"); revalidatePath("/"); revalidatePath("/qr");
  return { ok: true };
}

export async function setSocialLinkActive(id: string, active: boolean) {
  const { user } = await requireRole(["admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad id" };
  await supabaseAdmin.from("social_links").update({ is_active: active }).eq("id", id);
  await audit({ actor_id: user.id, action: "TOGGLE_SOCIAL_LINK", target_table: "social_links", target_id: id, new_data: { active } });
  revalidatePath("/admin/settings"); revalidatePath("/"); revalidatePath("/qr");
  return { ok: true };
}

export async function deleteSocialLink(id: string) {
  const { user } = await requireRole(["admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad id" };
  await supabaseAdmin.from("social_links").delete().eq("id", id);
  await audit({ actor_id: user.id, action: "DELETE_SOCIAL_LINK", target_table: "social_links", target_id: id });
  revalidatePath("/admin/settings"); revalidatePath("/"); revalidatePath("/qr");
  return { ok: true };
}
