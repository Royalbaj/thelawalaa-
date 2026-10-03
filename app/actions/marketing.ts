"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { CHANNELS, LANDINGS } from "@/lib/marketing-shared";

// Admin → Marketing: campaigns, what they cost, and the ROI settings.

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const money = z.number().min(0).max(10_000_000);

const campaignSchema = z.object({
  name: z.string().trim().min(2, "Give the campaign a name").max(80),
  channel: z.enum(Object.keys(CHANNELS) as [keyof typeof CHANNELS, ...(keyof typeof CHANNELS)[]]),
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,29}$/, "Link name: 2–30 letters, numbers or dashes"),
  landing_path: z.enum(Object.keys(LANDINGS) as [keyof typeof LANDINGS, ...(keyof typeof LANDINGS)[]]),
  promo_code_id: z.string().uuid().nullable().optional(),
  budget: money.nullable().optional(),
  starts_on: day,
  ends_on: day.nullable().optional(),
  notes: z.string().trim().max(500).optional(),
}).refine((v) => !v.ends_on || v.ends_on >= v.starts_on, { message: "The end date is before the start", path: ["ends_on"] });

const done = () => { revalidatePath("/admin/marketing"); return { ok: true as const }; };

export async function saveCampaign(id: string | null, input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the campaign" };
  const row = { ...parsed.data, promo_code_id: parsed.data.promo_code_id ?? null, budget: parsed.data.budget ?? null, ends_on: parsed.data.ends_on ?? null, notes: parsed.data.notes || null };
  if (id && !z.string().uuid().safeParse(id).success) return { error: "Campaign not found" };
  const { data, error } = id
    ? await supabaseAdmin.from("marketing_campaigns").update(row).eq("id", id).select("id").single()
    : await supabaseAdmin.from("marketing_campaigns").insert({ ...row, created_by: user.id }).select("id").single();
  if (error?.code === "23505") return { error: `The link name “${row.code}” is already used — pick another` };
  if (error || !data) return { error: "Couldn't save the campaign — try again" };
  await audit({ actor_id: user.id, action: id ? "UPDATE_CAMPAIGN" : "CREATE_CAMPAIGN", target_table: "marketing_campaigns", target_id: data.id, new_data: row });
  return done();
}

export async function setCampaignStatus(id: string, status: "active" | "paused" | "ended") {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success || !["active", "paused", "ended"].includes(status)) return { error: "Not found" };
  await supabaseAdmin.from("marketing_campaigns").update({ status }).eq("id", id);
  await audit({ actor_id: user.id, action: "CAMPAIGN_STATUS", target_table: "marketing_campaigns", target_id: id, new_data: { status } });
  return done();
}

/** Deleting a campaign deletes its cost entries; its orders and sign-ups just lose the link. */
export async function deleteCampaign(id: string) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Not found" };
  await supabaseAdmin.from("marketing_campaigns").delete().eq("id", id);
  await audit({ actor_id: user.id, action: "DELETE_CAMPAIGN", target_table: "marketing_campaigns", target_id: id });
  return done();
}

const costSchema = z.object({
  campaign_id: z.string().uuid("Pick a campaign"),
  spent_on: day,
  amount: z.number().positive("Enter the amount spent").max(10_000_000),
  note: z.string().trim().max(200).optional(),
});

export async function addMarketingCost(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = costSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the cost" };
  const { data, error } = await supabaseAdmin.from("marketing_costs")
    .insert({ ...parsed.data, note: parsed.data.note || null, created_by: user.id }).select("id").single();
  if (error || !data) return { error: "Couldn't save the cost — try again" };
  await audit({ actor_id: user.id, action: "ADD_MARKETING_COST", target_table: "marketing_costs", target_id: data.id, new_data: parsed.data });
  return done();
}

export async function deleteMarketingCost(id: string) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Not found" };
  const { data: old } = await supabaseAdmin.from("marketing_costs").select("campaign_id, spent_on, amount, note").eq("id", id).maybeSingle();
  await supabaseAdmin.from("marketing_costs").delete().eq("id", id);
  await audit({ actor_id: user.id, action: "DELETE_MARKETING_COST", target_table: "marketing_costs", target_id: id, old_data: old });
  return done();
}

export async function saveMarketingSettings(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = z.object({ gross_margin_pct: z.number().min(0).max(100), monthly_budget: money.nullable() }).safeParse(input);
  if (!parsed.success) return { error: "Margin is 0–100%; the budget can't be negative" };
  const { error } = await supabaseAdmin.from("marketing_settings")
    .update({ ...parsed.data, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { error: "Couldn't save — try again" };
  await audit({ actor_id: user.id, action: "MARKETING_SETTINGS", target_table: "marketing_settings", new_data: parsed.data });
  return done();
}
