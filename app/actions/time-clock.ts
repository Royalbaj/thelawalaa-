"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { isPin, verifyPin } from "@/lib/accounts-pin";
import { isYmd } from "@/lib/dates";
import { clockTime, fromNepal, isStale } from "@/lib/time-clock";

// POS time clock (migration 036). The POS login is shared, so each counter
// person clocks in and out with their own 4-digit PIN — the same person and
// PIN as staff training. The POS is told names and times only, never hours
// worked; hours are for the admin (Admin → Staff Hours).

const uuid = z.string().uuid();
const DAY = 86_400_000;

// ── POS ──────────────────────────────────────────────────────────

/** 5 wrong PINs in 15 minutes on this login locks the clock for a while. */
async function pinLocked(userId: string) {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await supabaseAdmin.from("audit_logs").select("id", { count: "exact", head: true })
    .eq("action", "CLOCK_PIN_FAIL").eq("actor_id", userId).gte("created_at", since);
  return (count ?? 0) >= 5;
}

/** The PIN alone says who is at the counter (active PINs are unique). */
async function personForPin(userId: string, pin: unknown): Promise<{ person: { id: string; name: string } } | { error: string }> {
  if (!isPin(pin)) return { error: "Enter your 4-digit PIN" };
  if (await pinLocked(userId)) return { error: "Too many wrong PINs — wait 15 minutes, or ask the manager" };
  const { data: people } = await supabaseAdmin.from("training_people").select("id, name, pin_hash, pos_clock").eq("is_active", true);
  for (const p of people ?? []) {
    if (!(await verifyPin(pin, p.pin_hash))) continue;
    if (!p.pos_clock) return { error: `${p.name}, you're not set up to clock in here — ask the manager` };
    return { person: { id: p.id, name: p.name } };
  }
  await audit({ actor_id: userId, action: "CLOCK_PIN_FAIL", target_table: "staff_shifts" });
  return { error: "That PIN isn't right — try again" };
}

async function openShift(personId: string) {
  const { data } = await supabaseAdmin.from("staff_shifts").select("id, clock_in")
    .eq("person_id", personId).is("clock_out", null).eq("missed_out", false).maybeSingle();
  return data;
}

/** POS → Clock: who is clocked in right now, and since when. No hours. */
export async function getClockBoard() {
  await requireRole(["pos_user"]);
  const { data } = await supabaseAdmin.from("staff_shifts").select("person_name, clock_in")
    .is("clock_out", null).eq("missed_out", false).order("clock_in");
  return (data ?? []).filter((s) => !isStale(s.clock_in)).map((s) => ({ name: s.person_name, since: s.clock_in }));
}

/** Step 1 — the PIN: who it is, and whether they're clocking in or out. */
export async function checkClockPin(pin: unknown) {
  const { user } = await requireRole(["pos_user"]);
  const r = await personForPin(user.id, pin);
  if ("error" in r) return r;
  const open = await openShift(r.person.id);
  const on = !!open && !isStale(open.clock_in);
  return {
    ok: true as const, name: r.person.name, clockedIn: on,
    since: on ? open!.clock_in : null,
    // Left open from an earlier shift: they forgot to clock out (the admin fixes the time).
    missedSince: open && !on ? open.clock_in : null,
  };
}

/** Step 2 — clock in or out. The PIN is checked again: the screen never says who. */
export async function punchClock(pin: unknown, action: unknown) {
  const { user } = await requireRole(["pos_user"]);
  if (action !== "in" && action !== "out") return { error: "Pick clock in or clock out" };
  const r = await personForPin(user.id, pin);
  if ("error" in r) return r;
  const { person } = r;
  const open = await openShift(person.id);
  const on = !!open && !isStale(open.clock_in);
  const now = new Date().toISOString();

  if (action === "out") {
    if (!on) return { error: `${person.name} isn't clocked in` };
    const { data } = await supabaseAdmin.from("staff_shifts").update({ clock_out: now, out_by: user.id })
      .eq("id", open!.id).is("clock_out", null).select("id");
    if (!data?.length) return { error: "Already clocked out" };
    await audit({ actor_id: user.id, action: "CLOCK_OUT", target_table: "staff_shifts", target_id: open!.id, new_data: { person: person.name } });
    return { ok: true as const, name: person.name, action: "out" as const, at: now };
  }

  if (on) return { error: `${person.name} is already clocked in` };
  if (open) {
    await supabaseAdmin.from("staff_shifts").update({ missed_out: true }).eq("id", open.id);
    await audit({ actor_id: user.id, action: "SHIFT_MISSED", target_table: "staff_shifts", target_id: open.id, new_data: { person: person.name } });
  }
  const { data, error } = await supabaseAdmin.from("staff_shifts")
    .insert({ person_id: person.id, person_name: person.name, clock_in: now, in_by: user.id }).select("id").single();
  if (error || !data) return { error: error?.code === "23505" ? `${person.name} is already clocked in` : "Couldn't clock in — try again" };
  await audit({ actor_id: user.id, action: "CLOCK_IN", target_table: "staff_shifts", target_id: data.id, new_data: { person: person.name } });
  return { ok: true as const, name: person.name, action: "in" as const, at: now };
}

// ── Admin → Staff Hours ─────────────────────────────────────────

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time");
const shiftSchema = z.object({
  person_id: uuid.optional(),            // only when adding — an edit keeps the person
  date: z.string().refine(isYmd, "Pick the date"),
  in: hm,
  out: z.union([hm, z.literal("")]),     // "" = still on the clock (only for the shift running now)
  note: z.string().trim().max(120, "Keep the note under 120 characters").optional(),
});

/** Times are Banepa time. A clock-out earlier than the clock-in is the next morning. */
function toInstants(date: string, inHm: string, outHm: string) {
  const clockIn = fromNepal(date, inHm);
  let clockOut = outHm ? fromNepal(date, outHm) : null;
  if (clockOut && clockOut <= clockIn) clockOut = new Date(clockOut.getTime() + DAY);
  return { clockIn, clockOut };
}

/** Another shift of the same person in that stretch of time? */
async function overlaps(personId: string, exceptId: string | null, clockIn: Date, clockOut: Date | null) {
  const end = clockOut ?? new Date();
  const { data } = await supabaseAdmin.from("staff_shifts").select("id, clock_in, clock_out, missed_out")
    .eq("person_id", personId)
    .gte("clock_in", new Date(clockIn.getTime() - DAY).toISOString()).lte("clock_in", end.toISOString());
  return (data ?? []).find((s) => {
    if (s.id === exceptId) return false;
    const sIn = new Date(s.clock_in);
    const sOut = s.clock_out ? new Date(s.clock_out) : s.missed_out || isStale(s.clock_in) ? sIn : new Date();
    return sIn < end && (sOut > clockIn || sIn.getTime() === clockIn.getTime());
  });
}

/** Add a shift someone forgot to clock, or correct one (a forgotten clock-out, a wrong time). */
export async function saveShift(id: string | null, input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  if (id !== null && !uuid.safeParse(id).success) return { error: "Bad shift" };
  const parsed = shiftSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the times" };
  const d = parsed.data;
  const { clockIn, clockOut } = toInstants(d.date, d.in, d.out);
  const soon = Date.now() + 5 * 60_000;
  if (clockIn.getTime() > soon) return { error: "That clock-in time hasn't happened yet" };
  if (clockOut && clockOut.getTime() > soon) return { error: "That clock-out time hasn't happened yet" };

  let old: { person_id: string | null; person_name: string; clock_in: string; clock_out: string | null; missed_out: boolean } | null = null;
  if (id) {
    const { data } = await supabaseAdmin.from("staff_shifts").select("person_id, person_name, clock_in, clock_out, missed_out").eq("id", id).maybeSingle();
    if (!data) return { error: "That shift is gone — refresh the page" };
    old = data;
  }
  // Leaving the clock-out empty keeps them on the clock — only for the shift running now.
  if (!clockOut && (!old || old.clock_out || old.missed_out || isStale(clockIn.toISOString()))) {
    return { error: "Put in the clock-out time" };
  }

  let personId = old?.person_id ?? null;
  let personName = old?.person_name ?? "";
  if (!id) {
    if (!d.person_id) return { error: "Pick who worked" };
    const { data: p } = await supabaseAdmin.from("training_people").select("id, name").eq("id", d.person_id).maybeSingle();
    if (!p) return { error: "Pick who worked" };
    personId = p.id; personName = p.name;
  }
  if (personId) {
    const clash = await overlaps(personId, id, clockIn, clockOut);
    if (clash) {
      const day = new Date(clash.clock_in).toLocaleDateString("en-GB", { timeZone: "Asia/Kathmandu", weekday: "short", day: "numeric", month: "short" });
      return { error: `That overlaps ${personName}'s shift on ${day} from ${clockTime(clash.clock_in)} — fix that one first` };
    }
  }

  const row = {
    clock_in: clockIn.toISOString(), clock_out: clockOut?.toISOString() ?? null, missed_out: false,
    note: d.note || null, edited_by: user.id, edited_at: new Date().toISOString(),
  };
  const { data, error } = id
    ? await supabaseAdmin.from("staff_shifts").update(row).eq("id", id).select("id").single()
    : await supabaseAdmin.from("staff_shifts").insert({ ...row, person_id: personId, person_name: personName }).select("id").single();
  if (error || !data) return { error: error?.code === "23505" ? `${personName} is already on the clock` : "Couldn't save the shift" };
  await audit({
    actor_id: user.id, action: id ? "SHIFT_EDIT" : "SHIFT_ADD", target_table: "staff_shifts", target_id: data.id,
    old_data: old ? { clock_in: old.clock_in, clock_out: old.clock_out, missed_out: old.missed_out } : undefined,
    new_data: { person: personName, clock_in: row.clock_in, clock_out: row.clock_out, note: row.note },
  });
  revalidatePath("/admin/hours");
  return { ok: true };
}

/** "Clock out now" — someone left without tapping out, and they've only just gone. */
export async function adminClockOut(id: string) {
  const { user } = await requireRole(["super_admin"]);
  if (!uuid.safeParse(id).success) return { error: "Bad shift" };
  const now = new Date().toISOString();
  const { data } = await supabaseAdmin.from("staff_shifts")
    .update({ clock_out: now, out_by: user.id, edited_by: user.id, edited_at: now })
    .eq("id", id).is("clock_out", null).eq("missed_out", false).select("id, person_name");
  if (!data?.length) return { error: "They're already clocked out — refresh the page" };
  await audit({ actor_id: user.id, action: "CLOCK_OUT", target_table: "staff_shifts", target_id: id, new_data: { person: data[0].person_name, by: "admin" } });
  revalidatePath("/admin/hours");
  return { ok: true };
}

export async function deleteShift(id: string) {
  const { user } = await requireRole(["super_admin"]);
  if (!uuid.safeParse(id).success) return { error: "Bad shift" };
  const { data } = await supabaseAdmin.from("staff_shifts").delete().eq("id", id)
    .select("person_name, clock_in, clock_out");
  if (!data?.length) return { error: "That shift is already gone" };
  await audit({ actor_id: user.id, action: "SHIFT_DELETE", target_table: "staff_shifts", target_id: id, old_data: data[0] });
  revalidatePath("/admin/hours");
  return { ok: true };
}
