"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { isYmd, nepalToday } from "@/lib/dates";
import { syncAlertState } from "@/lib/stock";
import { LOSS_KIND_KEYS } from "@/lib/loss-kinds";

// Waste & loss (migration 052): food wasted, things broken, missing, any other
// loss. Not the money book. A stock item's amount also comes off stock (a
// 'wastage' movement), and removing the loss puts it back.

const BUCKET = "account-bills";
// Only paths this app hands out: losses/2026/11/<uuid>.jpg
const PHOTO_PATH = /^losses\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const refresh = () => revalidatePath("/", "layout");
const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

/** A one-time signed upload slot for the photo — straight from the phone to Storage. */
export async function createLossPhotoUpload(contentType: string) {
  await requireAuth();
  const ext = PHOTO_TYPES[contentType];
  if (!ext) return { error: "Use a photo (JPG, PNG, WebP) or a PDF" };
  const today = nepalToday();
  const path = `losses/${today.slice(0, 4)}/${today.slice(5, 7)}/${randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "Couldn't start the upload" };
  return { path, token: data.token };
}

const optionalNumber = (max: number) => z.preprocess((v) => (v === "" || v == null ? undefined : v),
  z.coerce.number({ invalid_type_error: "Check the number" }).min(0, "Check the number").max(max, "That number is too big").optional());

const lossSchema = z.object({
  kind: z.enum(LOSS_KIND_KEYS as [string, ...string[]]),
  what: z.string().trim().min(2, "Say what it was").max(120, "Keep it under 120 characters"),
  occurred_on: z.string().refine(isYmd, "Pick a date"),
  stock_item_id: z.string().uuid().nullable().optional(),
  quantity: optionalNumber(1_000_000),
  value: optionalNumber(10_000_000),
  reason: z.string().trim().max(300, "Keep the reason under 300 characters").optional().transform((v) => v || null),
  photo_path: z.string().regex(PHOTO_PATH).nullable().optional(),
});

export async function saveLoss(input: unknown) {
  const { user, person } = await requireAuth();
  const parsed = lossSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form" };
  const d = parsed.data;
  if (d.occurred_on > nepalToday()) return { error: "That date hasn't happened yet" };

  let unit: string | null = null;
  let movementId: string | null = null;
  let value = d.value;
  const quantity = d.quantity == null ? null : round(d.quantity, 3);
  if (d.stock_item_id) {
    if (!quantity) return { error: "Say how much of it was lost" };
    const { data: item } = await supabaseAdmin.from("stock_items").select("id, unit, cost_per_unit").eq("id", d.stock_item_id).eq("is_active", true).maybeSingle();
    if (!item) return { error: "That stock item is gone — refresh" };
    unit = item.unit;
    // No worth typed: work it out from the item's cost per unit (if it has one).
    if (value == null && Number(item.cost_per_unit) > 0) value = quantity * Number(item.cost_per_unit);
    const { data: mv, error } = await supabaseAdmin.from("stock_movements").insert({
      stock_item_id: item.id, type: "wastage", quantity, note: `Loss: ${d.what}${d.reason ? ` — ${d.reason}` : ""}`.slice(0, 200),
      created_by: user.id, entered_by: person.id,
    }).select("id").single();
    if (error || !mv) return { error: "Couldn't take it off stock" };
    movementId = mv.id;
  }

  const row = {
    occurred_on: d.occurred_on, kind: d.kind, what: d.what, stock_item_id: d.stock_item_id ?? null,
    quantity, unit, movement_id: movementId, value: round(value ?? 0, 2), reason: d.reason,
    photo_path: d.photo_path ?? null, entered_by: person.id, created_by: user.id,
  };
  const { data, error } = await supabaseAdmin.from("account_losses").insert(row).select("id").single();
  if (error || !data) {
    if (movementId) await supabaseAdmin.from("stock_movements").delete().eq("id", movementId);
    return { error: "Couldn't save the loss" };
  }
  if (d.stock_item_id) await syncAlertState(d.stock_item_id);
  await audit({ actor_id: user.id, action: "LOSS_ADD", target_table: "account_losses", target_id: data.id, new_data: { ...row, person: person.name } });
  refresh();
  return { ok: true as const, id: data.id, value: row.value };
}

/** Remove a loss written on this page — its stock comes back, its photo is deleted. */
export async function deleteLoss(id: string) {
  const { user, person } = await requireAuth();
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad entry" };
  const { data: old } = await supabaseAdmin.from("account_losses").select("*").eq("id", id).maybeSingle();
  if (!old) return { error: "Already removed — refresh" };
  const { error } = await supabaseAdmin.from("account_losses").delete().eq("id", id);
  if (error) return { error: "Couldn't remove it" };
  if (old.movement_id) await supabaseAdmin.from("stock_movements").delete().eq("id", old.movement_id);
  if (old.stock_item_id) await syncAlertState(old.stock_item_id);
  if (old.photo_path) await supabaseAdmin.storage.from(BUCKET).remove([old.photo_path]);
  await audit({ actor_id: user.id, action: "LOSS_REMOVE", target_table: "account_losses", target_id: id, old_data: old, new_data: { person: person.name } });
  refresh();
  return { ok: true as const };
}
