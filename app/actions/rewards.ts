"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { testEmail } from "@/lib/account-emails";

const settingsSchema = z.object({
  enabled: z.boolean(),
  earn_rupees_per_100: z.coerce.number().min(0, "Earning can't be negative").max(100, "That's more than the order is worth"),
  points_per_rupee: z.coerce.number().int("Use a whole number of points").min(1).max(10000),
  min_redeem_points: z.coerce.number().int().min(0).max(10_000_000),
  welcome_points: z.coerce.number().int().min(0).max(100000),
  free_item_enabled: z.boolean(),
  free_item_orders: z.coerce.number().int().min(1, "At least 1 order").max(1000),
  free_item_product_id: z.string().uuid().nullable(),
});

/** Admin → Rewards. New rules apply from the next paid order; balances already earned stay as they are. */
export async function saveRewardSettings(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the settings" };
  if (parsed.data.free_item_enabled && !parsed.data.free_item_product_id) return { error: "Pick which item is free" };
  const { error } = await supabaseAdmin.from("reward_settings")
    .update({ ...parsed.data, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { error: "Couldn't save — try again" };
  await audit({ actor_id: user.id, action: "REWARD_SETTINGS", target_table: "reward_settings", new_data: parsed.data });
  revalidatePath("/admin/rewards");
  revalidatePath("/account", "layout");
  return { ok: true };
}

/** Admin → Settings: send the branded test email to yourself and report exactly what Resend says. */
export async function sendTestEmail() {
  const { user, profile } = await requireRole(["super_admin"]);
  if (!user.email) return { error: "Your account has no email address" };
  const r = await sendEmail({ to: user.email, ...testEmail(profile.full_name) });
  return r.ok ? { ok: true, to: user.email } : { error: r.error };
}
