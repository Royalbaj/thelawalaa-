"use server";

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { posStaffWith, getPosStaff, posLoginKey } from "@/lib/pos-staff";
import { OUTLET_FEATURES } from "@/lib/pos-features";
import { getOutletDay as loadOutletDay, syncStockAlert } from "@/lib/outlet";
import { EXPENSE_CATEGORIES, ISSUE_KINDS, PAID_WITH } from "@/lib/pos-outlet";
import { nepalToday } from "@/lib/dates";

// The outlet's own records at the POS (migration 051): day expenses, issues &
// notes, adding stock and asking for stock/expense fixes. Each needs the
// feature in the logged-in person's POS role (Admin → POS team & roles). Kept
// apart from the Accounts money book — the Accounts app's POS section shows
// them, and its people approve the change requests.

const uuid = z.string().uuid();
const BILLS = "pos-bills";
// Only paths this app hands out: 2026/11/<uuid>.jpg
const BILL_PATH = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;
const BILL_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const money = z.coerce.number({ invalid_type_error: "Enter the amount" }).positive("Enter the amount").max(1_000_000, "That amount is too big")
  .transform((v) => Math.round(v * 100) / 100);
const qty = z.coerce.number({ invalid_type_error: "Enter the amount" }).min(0, "Enter the amount").max(1_000_000)
  .transform((v) => Math.round(v * 1000) / 1000);
const why = z.string().trim().min(2, "Say why").max(300, "Keep it under 300 characters");

/** The POS outlet sheet: today's expenses, issues, recent stock adds and requests — for anyone with an outlet feature. */
export async function getOutletDay() {
  const { user } = await requireRole(["pos_user"]);
  const staff = await getPosStaff(posLoginKey(user));
  if (!staff || !OUTLET_FEATURES.some((f) => staff.features.includes(f))) return { error: "Your role doesn't have the outlet tools" } as const;
  return { ...(await loadOutletDay()), me: staff.id, features: staff.features };
}

// ── Day expenses ─────────────────────────────────────────────────
/** A one-time signed upload slot for the bill photo — straight from the phone/iPad to Storage. */
export async function createPosBillUpload(contentType: string) {
  const { user } = await requireRole(["pos_user"]);
  const gate = await posStaffWith(user, "expenses");
  if ("error" in gate) return { error: gate.error };
  const ext = BILL_TYPES[contentType];
  if (!ext) return { error: "Use a photo (JPG, PNG, WebP) or a PDF" };
  const today = nepalToday();
  const path = `${today.slice(0, 4)}/${today.slice(5, 7)}/${randomUUID()}.${ext}`;
  const { data, error } = await supabaseAdmin.storage.from(BILLS).createSignedUploadUrl(path);
  if (error || !data) return { error: "Couldn't start the upload" };
  return { path, token: data.token };
}

const expenseSchema = z.object({
  amount: money,
  reason: z.string().trim().min(2, "Write what it was for").max(300, "Keep the reason under 300 characters"),
  category: z.enum(EXPENSE_CATEGORIES, { errorMap: () => ({ message: "Pick what kind of cost it was" }) }),
  paid_with: z.enum(Object.keys(PAID_WITH) as [keyof typeof PAID_WITH], { errorMap: () => ({ message: "Pick how it was paid" }) }),
  bill_path: z.string().regex(BILL_PATH).nullable().optional(),
});

export async function addPosExpense(input: unknown) {
  const { user } = await requireRole(["pos_user"]);
  const gate = await posStaffWith(user, "expenses");
  if ("error" in gate) return { error: gate.error };
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the expense" };
  const d = parsed.data;
  if (d.bill_path) {
    // The photo must really be there (uploaded with the slot above).
    const { data: f } = await supabaseAdmin.storage.from(BILLS).list(d.bill_path.slice(0, 7), { search: d.bill_path.slice(8) });
    if (!f?.length) return { error: "The bill photo didn't upload — try again or save without it" };
  }
  const { data, error } = await supabaseAdmin.from("pos_expenses").insert({
    amount: d.amount, reason: d.reason, category: d.category, paid_with: d.paid_with, bill_path: d.bill_path ?? null,
    occurred_on: nepalToday(), person_id: gate.staff.id, person_name: gate.staff.name, created_by: user.id,
  }).select("id").single();
  if (error || !data) return { error: "Couldn't save the expense" };
  await audit({ actor_id: user.id, action: "POS_EXPENSE_ADD", target_table: "pos_expenses", target_id: data.id, new_data: { ...d, person: gate.staff.name } });
  return { ok: true };
}

/** Changing or removing an expense waits for an Accounts person (Accounts → POS → Approvals). */
export async function requestExpenseChange(expenseId: string, input: unknown) {
  const { user } = await requireRole(["pos_user"]);
  const gate = await posStaffWith(user, "expenses");
  if ("error" in gate) return { error: gate.error };
  if (!uuid.safeParse(expenseId).success) return { error: "Bad expense" };
  const parsed = z.object({
    remove: z.boolean().default(false),
    amount: money.optional(), reason: z.string().trim().min(2).max(300).optional(),
    category: z.enum(EXPENSE_CATEGORIES).optional(),
    paid_with: z.enum(Object.keys(PAID_WITH) as [keyof typeof PAID_WITH]).optional(),
    why,
  }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the change" };
  const d = parsed.data;
  const { data: e } = await supabaseAdmin.from("pos_expenses").select("id, amount, reason, category, paid_with, created_at, removed_at").eq("id", expenseId).maybeSingle();
  if (!e || e.removed_at) return { error: "That expense is gone — refresh" };
  if (Date.now() - new Date(e.created_at).getTime() > 7 * 86_400_000) return { error: "That's over a week old — ask the manager in Accounts" };
  if (await pendingFor(expenseId)) return { error: "A change for this is already waiting for approval" };
  const change = d.remove ? {} : {
    ...(d.amount !== undefined && d.amount !== Number(e.amount) ? { amount: d.amount } : {}),
    ...(d.reason !== undefined && d.reason !== e.reason ? { reason: d.reason } : {}),
    ...(d.category !== undefined && d.category !== e.category ? { category: d.category } : {}),
    ...(d.paid_with !== undefined && d.paid_with !== e.paid_with ? { paid_with: d.paid_with } : {}),
  };
  if (!d.remove && !Object.keys(change).length) return { error: "Nothing's different — change something first" };
  return saveRequest(user.id, gate.staff, d.remove ? "expense_remove" : "expense_edit", expenseId, {
    ...change, old_amount: Number(e.amount), old_reason: e.reason, old_category: e.category, old_paid_with: e.paid_with,
  }, d.why);
}

// ── Stock ────────────────────────────────────────────────────────
/** Stock that's arrived — counts straight away (shared with Accounts → Stock, marked "POS"). */
export async function addPosStock(input: unknown) {
  const { user } = await requireRole(["pos_user"]);
  const gate = await posStaffWith(user, "stock_add");
  if ("error" in gate) return { error: gate.error };
  const parsed = z.object({ item: uuid, quantity: qty, note: z.string().trim().max(200).optional() }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the amount" };
  const { item, quantity, note } = parsed.data;
  if (quantity <= 0) return { error: "Enter how much arrived" };
  const { data: s } = await supabaseAdmin.from("stock_items").select("id, name, is_active").eq("id", item).maybeSingle();
  if (!s?.is_active) return { error: "That stock item is gone — refresh" };
  const { data, error } = await supabaseAdmin.from("stock_movements").insert({
    stock_item_id: item, type: "restock", quantity, note: note || null, created_by: user.id,
    source: "pos", pos_person_id: gate.staff.id, pos_person_name: gate.staff.name,
  }).select("id").single();
  if (error || !data) return { error: "Couldn't add the stock" };
  await syncStockAlert(item);
  await audit({ actor_id: user.id, action: "POS_STOCK_ADD", target_table: "stock_items", target_id: item, new_data: { quantity, note, item: s.name, person: gate.staff.name } });
  return { ok: true };
}

const stockRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("stock_waste"), item: uuid, quantity: qty, why }),
  z.object({ kind: z.literal("stock_count"), item: uuid, quantity: qty, why }),
  // A stock add from the POS that was wrong: the right amount (0 = it never came).
  z.object({ kind: z.literal("stock_fix"), movement: uuid, quantity: qty, why }),
]);

/** Waste, a recount or fixing an add — waits for an Accounts person (Accounts → POS → Approvals). */
export async function requestStockChange(input: unknown) {
  const { user } = await requireRole(["pos_user"]);
  const gate = await posStaffWith(user, "stock_edit");
  if ("error" in gate) return { error: gate.error };
  const parsed = stockRequestSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the change" };
  const d = parsed.data;

  if (d.kind === "stock_fix") {
    const { data: m } = await supabaseAdmin.from("stock_movements").select("id, quantity, source, type, created_at, stock_items(name, unit)").eq("id", d.movement).maybeSingle();
    if (!m || m.source !== "pos" || m.type !== "restock") return { error: "Only stock added on the POS can be fixed here" };
    if (Date.now() - new Date(m.created_at).getTime() > 7 * 86_400_000) return { error: "That's over a week old — ask the manager in Accounts" };
    if (Number(m.quantity) === d.quantity) return { error: "That's the amount it already says" };
    if (await pendingFor(d.movement)) return { error: "A fix for this is already waiting for approval" };
    const it = m.stock_items as unknown as { name: string; unit: string } | null;
    return saveRequest(user.id, gate.staff, "stock_fix", d.movement, { quantity: d.quantity, old_quantity: Number(m.quantity), item: it?.name, unit: it?.unit }, d.why);
  }
  if (d.kind === "stock_waste" && d.quantity <= 0) return { error: "Enter how much was wasted" };
  const { data: s } = await supabaseAdmin.from("stock_items").select("id, name, unit, is_active").eq("id", d.item).maybeSingle();
  if (!s?.is_active) return { error: "That stock item is gone — refresh" };
  return saveRequest(user.id, gate.staff, d.kind, d.item, { quantity: d.quantity, item: s.name, unit: s.unit }, d.why);
}

async function pendingFor(targetId: string) {
  const { count } = await supabaseAdmin.from("pos_change_requests").select("id", { count: "exact", head: true })
    .eq("target_id", targetId).eq("status", "pending");
  return (count ?? 0) > 0;
}

async function saveRequest(userId: string, staff: { id: string; name: string }, kind: string, targetId: string, payload: Record<string, unknown>, reason: string) {
  const { data, error } = await supabaseAdmin.from("pos_change_requests").insert({
    kind, target_id: targetId, payload, reason, person_id: staff.id, person_name: staff.name, created_by: userId,
  }).select("id").single();
  if (error || !data) return { error: "Couldn't send it for approval" };
  await audit({ actor_id: userId, action: "POS_CHANGE_REQUEST", target_table: "pos_change_requests", target_id: data.id, new_data: { kind, target_id: targetId, payload, reason, person: staff.name } });
  return { ok: true, pending: true };
}

// ── Issues & notes ───────────────────────────────────────────────
export async function addIssue(input: unknown) {
  const { user } = await requireRole(["pos_user"]);
  const gate = await posStaffWith(user, "issues");
  if ("error" in gate) return { error: gate.error };
  const parsed = z.object({
    title: z.string().trim().min(2, "Write what happened").max(120, "Keep it short — add more below"),
    details: z.string().trim().max(1000, "Keep the details under 1,000 characters").optional(),
    kind: z.enum(Object.keys(ISSUE_KINDS) as [keyof typeof ISSUE_KINDS]),
    urgent: z.boolean().default(false),
  }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the note" };
  const d = parsed.data;
  const { data, error } = await supabaseAdmin.from("pos_issues").insert({
    title: d.title, details: d.details || null, kind: d.kind, urgent: d.urgent,
    person_id: gate.staff.id, person_name: gate.staff.name, created_by: user.id,
  }).select("id").single();
  if (error || !data) return { error: "Couldn't save the note" };
  await audit({ actor_id: user.id, action: "POS_ISSUE_ADD", target_table: "pos_issues", target_id: data.id, new_data: { ...d, person: gate.staff.name } });
  return { ok: true };
}
