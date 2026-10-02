"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { getVerifiedUser, requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { PIN_COOKIE, PIN_TTL_SECONDS, signUnlock } from "@/lib/pin-cookie";
import { hashPin, isPin, verifyPin } from "@/lib/pin";

const MAX_TRIES = 5;
const LOCKOUT_MINUTES = 15;

async function storedPinHash() {
  const { data } = await supabaseAdmin.from("account_settings").select("pin_hash").eq("id", 1).single();
  return data?.pin_hash as string | undefined;
}

/** Wrong PINs are counted per account in the audit log: 5 in 15 minutes locks the PIN screen for a while. */
async function recentFailures(userId: string) {
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60_000).toISOString();
  const { count } = await supabaseAdmin.from("audit_logs").select("id", { count: "exact", head: true })
    .eq("actor_id", userId).eq("action", "ACCOUNTS_PIN_FAILED").gte("created_at", since);
  return count ?? 0;
}

export async function unlockWithPin(pin: string) {
  const { user } = await getVerifiedUser();
  if (!user) return { error: "Please sign in again" };
  if (!isPin(pin)) return { error: "Enter the PIN" };

  const failures = await recentFailures(user.id);
  if (failures >= MAX_TRIES) return { error: `Too many wrong tries — wait ${LOCKOUT_MINUTES} minutes` };

  const hash = await storedPinHash();
  if (!hash || !verifyPin(pin, hash)) {
    await audit({ actor_id: user.id, action: "ACCOUNTS_PIN_FAILED", target_table: "account_settings" });
    const left = MAX_TRIES - failures - 1;
    return { error: left > 0 ? `Wrong PIN — ${left} ${left === 1 ? "try" : "tries"} left` : `Wrong PIN — locked for ${LOCKOUT_MINUTES} minutes` };
  }

  (await cookies()).set(PIN_COOKIE, await signUnlock(user.id), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: PIN_TTL_SECONDS,
  });
  return { ok: true };
}

/** "Lock" button, the idle timer, and sign-out all come through here. */
export async function lockAccounts() {
  (await cookies()).delete(PIN_COOKIE);
  return { ok: true };
}

const changePinSchema = z.object({
  current: z.string(),
  next: z.string().regex(/^\d{4}$/, "The new PIN must be 4 digits"),
  confirm: z.string(),
}).refine((v) => v.next === v.confirm, { message: "The two new PINs don't match", path: ["confirm"] });

export async function changePin(input: unknown) {
  const { user } = await requireAuth();
  const parsed = changePinSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the PINs" };
  const hash = await storedPinHash();
  if (!hash || !isPin(parsed.data.current) || !verifyPin(parsed.data.current, hash)) {
    return { error: "The current PIN is wrong" };
  }
  const { error } = await supabaseAdmin.from("account_settings")
    .update({ pin_hash: hashPin(parsed.data.next), updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return { error: "Couldn't change the PIN" };
  await audit({ actor_id: user.id, action: "ACCOUNTS_PIN_CHANGED", target_table: "account_settings" });
  return { ok: true };
}
