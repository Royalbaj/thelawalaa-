"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { getVerifiedUser, requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { PIN_COOKIE, PIN_TTL_SECONDS, signUnlock } from "@/lib/pin-cookie";
import { hashPin, isPin, verifyPin, whosePin } from "@/lib/pin";

const MAX_TRIES = 5;
const LOCKOUT_MINUTES = 15;

async function activePeople() {
  const { data } = await supabaseAdmin.from("account_users").select("id, name, pin_hash").eq("is_active", true);
  return data ?? [];
}

/** Wrong PINs are counted per sign-in in the audit log: 5 in 15 minutes locks the PIN screen for a while. */
async function recentFailures(userId: string) {
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60_000).toISOString();
  const { count } = await supabaseAdmin.from("audit_logs").select("id", { count: "exact", head: true })
    .eq("actor_id", userId).eq("action", "ACCOUNTS_PIN_FAILED").gte("created_at", since);
  return count ?? 0;
}

/** The PIN says who is at the keyboard — each person has their own. */
export async function unlockWithPin(pin: string) {
  const { user } = await getVerifiedUser();
  if (!user) return { error: "Please sign in again" };
  if (!isPin(pin)) return { error: "Enter the PIN" };

  const [failures, people] = await Promise.all([recentFailures(user.id), activePeople()]);
  if (failures >= MAX_TRIES) return { error: `Too many wrong tries — wait ${LOCKOUT_MINUTES} minutes` };
  if (!people.length) return { error: "No one is set up yet — ask the admin to add you (Staff & Users → Accounts people)" };

  const person = await whosePin(pin, people);
  if (!person) {
    await audit({ actor_id: user.id, action: "ACCOUNTS_PIN_FAILED", target_table: "account_users" });
    const left = MAX_TRIES - failures - 1;
    return { error: left > 0 ? `Wrong PIN — ${left} ${left === 1 ? "try" : "tries"} left` : `Wrong PIN — locked for ${LOCKOUT_MINUTES} minutes` };
  }

  (await cookies()).set(PIN_COOKIE, await signUnlock(user.id, person.id), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: PIN_TTL_SECONDS,
  });
  await audit({ actor_id: user.id, action: "ACCOUNTS_UNLOCK", target_table: "account_users", target_id: person.id, new_data: { person: person.name } });
  return { ok: true, name: person.name };
}

/** "Lock" / "Switch person", the idle timer, and sign-out all come through here. */
export async function lockAccounts() {
  (await cookies()).delete(PIN_COOKIE);
  return { ok: true };
}

const changePinSchema = z.object({
  current: z.string(),
  next: z.string().regex(/^\d{4}$/, "The new PIN must be 4 digits"),
  confirm: z.string(),
}).refine((v) => v.next === v.confirm, { message: "The two new PINs don't match", path: ["confirm"] });

/** A person changes their OWN PIN. (Adding people and resetting PINs is in the admin panel.) */
export async function changePin(input: unknown) {
  const { user, person } = await requireAuth();
  const parsed = changePinSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the PINs" };
  const people = await activePeople();
  const me = people.find((p) => p.id === person.id);
  if (!me || !isPin(parsed.data.current) || !(await verifyPin(parsed.data.current, me.pin_hash))) {
    return { error: "Your current PIN is wrong" };
  }
  // The PIN alone says who someone is, so no two people can share one.
  if (await whosePin(parsed.data.next, people.filter((p) => p.id !== me.id))) {
    return { error: "Someone else already uses that PIN — pick another" };
  }
  const { error } = await supabaseAdmin.from("account_users")
    .update({ pin_hash: hashPin(parsed.data.next), updated_at: new Date().toISOString() }).eq("id", me.id);
  if (error) return { error: "Couldn't change the PIN" };
  await audit({ actor_id: user.id, action: "ACCOUNTS_PIN_CHANGED", target_table: "account_users", target_id: me.id, new_data: { person: me.name } });
  return { ok: true };
}
