import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { POS_STAFF_COOKIE, verifyPosStaff } from "@/lib/pos-staff-cookie";
import { isStale } from "@/lib/time-clock";

// Who is working the till on this device (migration 037). Logged in = a valid
// PIN cookie for this POS login AND an open shift — so clocking out, being
// clocked out from Admin, or a shift left open past 16 h all lock the till.

/** The PIN lock is on once anyone may clock in on the POS — until then the till works as before. */
export const posLockOn = cache(async () => {
  const { count } = await supabaseAdmin.from("training_people").select("id", { count: "exact", head: true })
    .eq("is_active", true).eq("pos_clock", true);
  return (count ?? 0) > 0;
});

export type PosStaff = { id: string; name: string; since: string };

/** The person logged in on this POS device, or null (locked). */
export const getPosStaff = cache(async (userId: string): Promise<PosStaff | null> => {
  const personId = verifyPosStaff(userId, (await cookies()).get(POS_STAFF_COOKIE)?.value);
  if (!personId) return null;
  const [{ data: p }, { data: shift }] = await Promise.all([
    supabaseAdmin.from("training_people").select("id, name, is_active, pos_clock").eq("id", personId).maybeSingle(),
    supabaseAdmin.from("staff_shifts").select("clock_in").eq("person_id", personId).is("clock_out", null).eq("missed_out", false).maybeSingle(),
  ]);
  if (!p?.is_active || !p.pos_clock || !shift || isStale(shift.clock_in)) return null;
  return { id: p.id, name: p.name, since: shift.clock_in };
});
