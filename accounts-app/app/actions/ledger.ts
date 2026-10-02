"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { isYmd, nepalToday } from "@/lib/dates";

const BILLS = "account-bills";
// Only paths this app hands out: bills/2026/10/<uuid>.jpg
const BILL_PATH = /^bills\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;
const BILL_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

const refresh = () => revalidatePath("/", "layout");

// ── Bills ───────────────────────────────────────────────────────
/** A one-time signed upload slot — the phone uploads the photo straight to Storage. */
export async function createBillUpload(contentType: string) {
  await requireAuth();
  const ext = BILL_TYPES[contentType];
  if (!ext) return { error: "Use a photo (JPG, PNG, WebP) or a PDF" };
  const today = nepalToday();
  const path = `bills/${today.slice(0, 4)}/${today.slice(5, 7)}/${randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from(BILLS).createSignedUploadUrl(path);
  if (error || !data) return { error: "Couldn't start the upload" };
  return { path, token: data.token };
}

async function removeBill(path: string | null | undefined) {
  if (path) await supabaseAdmin.storage.from(BILLS).remove([path]);
}

// ── Entries ─────────────────────────────────────────────────────
const entrySchema = z.object({
  kind: z.enum(["in", "out"]),
  amount: z.coerce.number({ invalid_type_error: "Enter the amount" }).positive("Enter the amount").max(100_000_000, "That amount is too big")
    .transform((v) => Math.round(v * 100) / 100),
  category_id: z.string().uuid("Pick a category"),
  occurred_on: z.string().refine(isYmd, "Pick a date"),
  method: z.enum(["cash", "bank", "qr"]),
  description: z.string().trim().max(300, "Keep the note under 300 characters").optional().transform((v) => v || null),
  bill_path: z.string().regex(BILL_PATH).nullable().optional(),
});

export async function saveEntry(id: string | null, input: unknown) {
  const { user } = await requireAuth();
  if (id !== null && !z.string().uuid().safeParse(id).success) return { error: "Bad entry" };
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  if (d.occurred_on > nepalToday()) return { error: "The date can't be in the future" };
  if (d.occurred_on < "2020-01-01") return { error: "Check the date" };

  const { data: cat } = await supabaseAdmin.from("account_categories").select("kind, is_active").eq("id", d.category_id).single();
  if (!cat || cat.kind !== d.kind) return { error: "Pick a category" };

  if (id === null) {
    if (!cat.is_active) return { error: "That category is hidden — pick another" };
    const { data, error } = await supabaseAdmin.from("account_transactions")
      .insert({ ...d, bill_path: d.bill_path ?? null, created_by: user.id }).select("id").single();
    if (error || !data) return { error: "Couldn't save the entry" };
    await audit({ actor_id: user.id, action: "ACCOUNT_ENTRY_ADD", target_table: "account_transactions", target_id: data.id, new_data: d });
    refresh();
    return { ok: true, id: data.id };
  }

  const { data: old } = await supabaseAdmin.from("account_transactions")
    .select("kind, amount, category_id, description, occurred_on, method, bill_path").eq("id", id).single();
  if (!old) return { error: "That entry no longer exists" };
  // An edit can keep a category that's since been hidden.
  if (!cat.is_active && old.category_id !== d.category_id) return { error: "That category is hidden — pick another" };
  // bill_path undefined = leave the bill alone; null = remove it; a path = the new bill.
  const billPath = d.bill_path === undefined ? old.bill_path : d.bill_path;
  const { error } = await supabaseAdmin.from("account_transactions")
    .update({ ...d, bill_path: billPath, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "Couldn't save the entry" };
  if (old.bill_path && old.bill_path !== billPath) await removeBill(old.bill_path);
  await audit({ actor_id: user.id, action: "ACCOUNT_ENTRY_EDIT", target_table: "account_transactions", target_id: id, old_data: old, new_data: { ...d, bill_path: billPath } });
  refresh();
  return { ok: true, id };
}

export async function deleteEntry(id: string) {
  const { user } = await requireAuth();
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad entry" };
  const { data: old } = await supabaseAdmin.from("account_transactions")
    .select("kind, amount, category_id, description, occurred_on, method, bill_path").eq("id", id).single();
  if (!old) return { ok: true };
  const { error } = await supabaseAdmin.from("account_transactions").delete().eq("id", id);
  if (error) return { error: "Couldn't delete the entry" };
  await removeBill(old.bill_path);
  await audit({ actor_id: user.id, action: "ACCOUNT_ENTRY_DELETE", target_table: "account_transactions", target_id: id, old_data: old });
  refresh();
  return { ok: true };
}

// ── Categories ──────────────────────────────────────────────────
const categoryName = z.string().trim().min(1, "Type a name").max(40, "Keep it under 40 characters");

export async function addCategory(kind: unknown, name: unknown) {
  const { user } = await requireAuth();
  const k = z.enum(["in", "out"]).safeParse(kind);
  const n = categoryName.safeParse(name);
  if (!k.success) return { error: "Bad category type" };
  if (!n.success) return { error: n.error.issues[0].message };
  const { data, error } = await supabaseAdmin.from("account_categories")
    .insert({ kind: k.data, name: n.data }).select("id, kind, name, sort_order, is_active").single();
  if (error?.code === "23505") return { error: "That category already exists" };
  if (error || !data) return { error: "Couldn't add the category" };
  await audit({ actor_id: user.id, action: "ACCOUNT_CATEGORY_ADD", target_table: "account_categories", target_id: data.id, new_data: data });
  refresh();
  return { ok: true, category: data };
}

export async function updateCategory(id: string, patch: unknown) {
  const { user } = await requireAuth();
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad category" };
  const parsed = z.object({ name: categoryName.optional(), is_active: z.boolean().optional() }).safeParse(patch);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the name" };
  const { error } = await supabaseAdmin.from("account_categories").update(parsed.data).eq("id", id);
  if (error?.code === "23505") return { error: "That category already exists" };
  if (error) return { error: "Couldn't update the category" };
  await audit({ actor_id: user.id, action: "ACCOUNT_CATEGORY_EDIT", target_table: "account_categories", target_id: id, new_data: parsed.data });
  refresh();
  return { ok: true };
}

// ── Opening balance ─────────────────────────────────────────────
export async function setOpeningBalance(amount: unknown) {
  const { user } = await requireAuth();
  const parsed = z.coerce.number().min(-100_000_000).max(100_000_000).safeParse(amount);
  if (!parsed.success) return { error: "Enter an amount" };
  const { error } = await supabaseAdmin.from("account_settings")
    .update({ opening_balance: Math.round(parsed.data * 100) / 100, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { error: "Couldn't save" };
  await audit({ actor_id: user.id, action: "ACCOUNT_OPENING_BALANCE", target_table: "account_settings", new_data: { opening_balance: parsed.data } });
  refresh();
  return { ok: true };
}
