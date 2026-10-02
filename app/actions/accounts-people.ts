"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { hashPin, isPin, verifyPin } from "@/lib/accounts-pin";

// Admin → Staff & Users → Accounts people: who may use the Accounts app,
// each with their own 4-digit PIN. The PIN alone tells Accounts who is at
// the keyboard, so no two active people can share one.

const nameSchema = z.string().trim().min(1, "Type a name").max(40, "Keep the name under 40 characters");
const pinSchema = z.string().refine(isPin, "The PIN must be 4 digits");

async function pinTaken(pin: string, exceptId?: string) {
  const { data } = await supabaseAdmin.from("account_users").select("id, pin_hash").eq("is_active", true);
  const others = (data ?? []).filter((p) => p.id !== exceptId);
  return (await Promise.all(others.map((p) => verifyPin(pin, p.pin_hash)))).some(Boolean);
}

export async function addAccountPerson(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = z.object({ name: nameSchema, pin: pinSchema }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the name and PIN" };
  if (await pinTaken(parsed.data.pin)) return { error: "Someone already uses that PIN — pick another" };
  const { data, error } = await supabaseAdmin.from("account_users")
    .insert({ name: parsed.data.name, pin_hash: hashPin(parsed.data.pin), created_by: user.id }).select("id").single();
  if (error || !data) return { error: "Couldn't add them" };
  await audit({ actor_id: user.id, action: "ACCOUNTS_PERSON_ADD", target_table: "account_users", target_id: data.id, new_data: { name: parsed.data.name } });
  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function updateAccountPerson(id: string, input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad person" };
  const parsed = z.object({ name: nameSchema.optional(), pin: pinSchema.optional(), is_active: z.boolean().optional() }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details" };
  const { name, pin, is_active } = parsed.data;
  // Someone switched back on might clash with a PIN handed out while they were off
  // (two salted hashes can't be compared), so they come back with a fresh PIN.
  if (is_active === true && !pin) return { error: "Give them a new PIN to switch them back on" };
  if (pin && await pinTaken(pin, id)) return { error: "Someone already uses that PIN — pick another" };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) patch.name = name;
  if (pin) patch.pin_hash = hashPin(pin);
  if (is_active !== undefined) patch.is_active = is_active;
  const { error } = await supabaseAdmin.from("account_users").update(patch).eq("id", id);
  if (error) return { error: "Couldn't save" };
  await audit({ actor_id: user.id, action: "ACCOUNTS_PERSON_EDIT", target_table: "account_users", target_id: id,
    new_data: { name, is_active, pin_changed: !!pin } });
  revalidatePath("/admin/staff");
  return { ok: true };
}
