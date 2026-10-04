"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { CATEGORY_KEYS } from "@/lib/marketing-shared";

// Admin → Marketing & ROI: the budget, the expenses and returns, activities.

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const ym = z.string().regex(/^\d{4}-\d{2}$/);
const category = z.enum(CATEGORY_KEYS);
const uuid = z.string().uuid();
const done = () => { revalidatePath("/admin/marketing"); return { ok: true as const }; };

const entrySchema = z.object({
  kind: z.enum(["expense", "return"]),
  entry_date: day,
  category,
  activity_id: uuid.nullable().optional(),
  amount: z.number().positive("Enter the amount").max(10_000_000),
  new_customers: z.number().int().min(0).max(100_000).nullable().optional(),
  payment_method: z.enum(["cash", "bank", "qr", "other"]).nullable().optional(),
  note: z.string().trim().max(300).optional(),
});

/** One expense or one return. Editing passes the id. */
export async function saveMarketingEntry(id: string | null, input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the entry" };
  if (id && !uuid.safeParse(id).success) return { error: "Entry not found" };
  const d = parsed.data;
  const row = {
    kind: d.kind, entry_date: d.entry_date, category: d.category, activity_id: d.activity_id ?? null, amount: d.amount,
    new_customers: d.kind === "return" ? d.new_customers ?? null : null,
    payment_method: d.kind === "expense" ? d.payment_method ?? null : null,
    note: d.note || null,
  };
  const { data, error } = id
    ? await supabaseAdmin.from("marketing_entries").update(row).eq("id", id).select("id").single()
    : await supabaseAdmin.from("marketing_entries").insert({ ...row, created_by: user.id }).select("id").single();
  if (error || !data) return { error: "Couldn't save — try again" };
  await audit({ actor_id: user.id, action: id ? "UPDATE_MARKETING_ENTRY" : "ADD_MARKETING_ENTRY", target_table: "marketing_entries", target_id: data.id, new_data: row });
  return done();
}

export async function deleteMarketingEntry(id: string) {
  const { user } = await requireRole(["super_admin"]);
  if (!uuid.safeParse(id).success) return { error: "Not found" };
  const { data: old } = await supabaseAdmin.from("marketing_entries").select("kind, entry_date, category, amount, note").eq("id", id).maybeSingle();
  await supabaseAdmin.from("marketing_entries").delete().eq("id", id);
  await audit({ actor_id: user.id, action: "DELETE_MARKETING_ENTRY", target_table: "marketing_entries", target_id: id, old_data: old });
  return done();
}

const budgetSchema = z.object({
  month: ym,
  total: z.number().min(0).max(100_000_000).nullable(),
  categories: z.record(category, z.number().min(0).max(100_000_000).nullable()),
});

/** The month's budget: the overall figure and any per-category ones. Blank = no budget. */
export async function saveMarketingBudget(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) return { error: "Budgets can't be negative" };
  const { month, total, categories } = parsed.data;
  const monthDate = `${month}-01`;
  const keep = [{ category: "total", amount: total }, ...Object.entries(categories).map(([c, amount]) => ({ category: c, amount }))];
  const upserts = keep.filter((k) => k.amount != null).map((k) => ({ month: monthDate, category: k.category, amount: k.amount!, updated_by: user.id, updated_at: new Date().toISOString() }));
  const clears = keep.filter((k) => k.amount == null).map((k) => k.category);
  if (upserts.length) {
    const { error } = await supabaseAdmin.from("marketing_budgets").upsert(upserts, { onConflict: "month,category" });
    if (error) return { error: "Couldn't save the budget — try again" };
  }
  if (clears.length) await supabaseAdmin.from("marketing_budgets").delete().eq("month", monthDate).in("category", clears);
  await audit({ actor_id: user.id, action: "SET_MARKETING_BUDGET", target_table: "marketing_budgets", new_data: parsed.data });
  return done();
}

const activitySchema = z.object({
  name: z.string().trim().min(2, "Give it a name").max(80),
  category,
  budget: z.number().min(0).max(100_000_000).nullable().optional(),
  starts_on: day,
  ends_on: day.nullable().optional(),
  notes: z.string().trim().max(500).optional(),
}).refine((v) => !v.ends_on || v.ends_on >= v.starts_on, { message: "The end date is before the start", path: ["ends_on"] });

/** An activity groups expenses and returns, e.g. "Membership cards" or "Dashain stall". */
export async function saveMarketingActivity(id: string | null, input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the activity" };
  if (id && !uuid.safeParse(id).success) return { error: "Not found" };
  const row = { ...parsed.data, budget: parsed.data.budget ?? null, ends_on: parsed.data.ends_on ?? null, notes: parsed.data.notes || null };
  const { data, error } = id
    ? await supabaseAdmin.from("marketing_activities").update(row).eq("id", id).select("id").single()
    : await supabaseAdmin.from("marketing_activities").insert({ ...row, created_by: user.id }).select("id").single();
  if (error || !data) return { error: "Couldn't save — try again" };
  await audit({ actor_id: user.id, action: id ? "UPDATE_MARKETING_ACTIVITY" : "CREATE_MARKETING_ACTIVITY", target_table: "marketing_activities", target_id: data.id, new_data: row });
  return done();
}

export async function setActivityStatus(id: string, status: "active" | "paused" | "ended") {
  const { user } = await requireRole(["super_admin"]);
  if (!uuid.safeParse(id).success || !["active", "paused", "ended"].includes(status)) return { error: "Not found" };
  await supabaseAdmin.from("marketing_activities").update({ status }).eq("id", id);
  await audit({ actor_id: user.id, action: "MARKETING_ACTIVITY_STATUS", target_table: "marketing_activities", target_id: id, new_data: { status } });
  return done();
}

/** Its expenses and returns stay (just without the activity name). */
export async function deleteMarketingActivity(id: string) {
  const { user } = await requireRole(["super_admin"]);
  if (!uuid.safeParse(id).success) return { error: "Not found" };
  await supabaseAdmin.from("marketing_activities").delete().eq("id", id);
  await audit({ actor_id: user.id, action: "DELETE_MARKETING_ACTIVITY", target_table: "marketing_activities", target_id: id });
  return done();
}

export async function saveMarketingSettings(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = z.object({ gross_margin_pct: z.number().min(0).max(100) }).safeParse(input);
  if (!parsed.success) return { error: "Margin is a % between 0 and 100" };
  const { error } = await supabaseAdmin.from("marketing_settings")
    .update({ ...parsed.data, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { error: "Couldn't save — try again" };
  await audit({ actor_id: user.id, action: "MARKETING_SETTINGS", target_table: "marketing_settings", new_data: parsed.data });
  return done();
}
