"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";

const schema = z.object({ esewa_enabled: z.boolean(), delivery_enabled: z.boolean() });

/** Site-wide feature flags — super_admin only, see app_settings migration. */
export async function updateAppSettings(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Invalid settings" };

  const { error } = await supabaseAdmin
    .from("app_settings")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { error: "Could not update settings" };

  await audit({ actor_id: user.id, action: "UPDATE_APP_SETTINGS", target_table: "app_settings", target_id: "1", new_data: parsed.data });
  revalidatePath("/super-admin/settings");
  revalidatePath("/order");
  revalidatePath("/");
  return { ok: true };
}

export async function getAppSettings() {
  const { data } = await supabaseAdmin.from("app_settings").select("esewa_enabled, delivery_enabled").eq("id", 1).single();
  return data ?? { esewa_enabled: false, delivery_enabled: false };
}
