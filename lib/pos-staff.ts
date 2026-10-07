import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { POS_STAFF_COOKIE, verifyPosStaff } from "@/lib/pos-staff-cookie";
import { isStale } from "@/lib/time-clock";

// Who is working the till on this device (migration 037). Logged in = a valid
// PIN cookie for this POS login for someone who's still allowed on the POS.
// Logging in and clocking in are separate (owner's call): staff log in and out
// of the till as often as they swap, but clock in and out once a shift.

/** The PIN lock is on once anyone may clock in on the POS — until then the till works as before. */
export const posLockOn = cache(async () => {
  const { count } = await supabaseAdmin.from("training_people").select("id", { count: "exact", head: true })
    .eq("is_active", true).eq("pos_clock", true);
  return (count ?? 0) > 0;
});

export type PosStaff = { id: string; name: string; clockedInSince: string | null };

/** This sign-in of the POS login: a new password sign-in changes it, so old till logins stop working. */
export const posLoginKey = (user: { id: string; last_sign_in_at?: string | null }) => `${user.id}|${user.last_sign_in_at ?? ""}`;

/** The person logged in on this POS device (pass posLoginKey(user)), or null (locked). */
export const getPosStaff = cache(async (loginKey: string): Promise<PosStaff | null> => {
  const personId = verifyPosStaff(loginKey, (await cookies()).get(POS_STAFF_COOKIE)?.value);
  if (!personId) return null;
  const [{ data: p }, { data: shift }] = await Promise.all([
    supabaseAdmin.from("training_people").select("id, name, is_active, pos_clock").eq("id", personId).maybeSingle(),
    supabaseAdmin.from("staff_shifts").select("clock_in").eq("person_id", personId).is("clock_out", null).eq("missed_out", false).maybeSingle(),
  ]);
  if (!p?.is_active || !p.pos_clock) return null;
  return { id: p.id, name: p.name, clockedInSince: shift && !isStale(shift.clock_in) ? shift.clock_in : null };
});
