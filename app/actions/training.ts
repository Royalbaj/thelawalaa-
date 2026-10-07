"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { extractYouTubeId } from "@/lib/youtube";
import { hashPin, isPin, verifyPin } from "@/lib/accounts-pin";
import { TRAINEE_COOKIE, TRAINEE_TTL_SECONDS, signTrainee, verifyTrainee } from "@/lib/training-pin-cookie";
import { closeOpenShift } from "@/lib/time-clock";

// Staff training. The POS login is shared, so training is per PERSON: the
// admin adds each staff member with their own 4-digit PIN and picks which
// videos they must watch (Admin → Staff Training). On /staff they enter the
// PIN, see only their videos, and progress is saved against them.
// The same person + PIN clocks in and out on the POS when pos_clock is on
// (Admin → Staff Hours, app/actions/time-clock.ts).

const STAFF_ROLES = ["pos_user", "delivery_driver", "super_admin"];

const trainingVideoSchema = z.object({
  title: z.string().trim().min(2, "Give the video a title").max(100),
  youtube_url: z.string().trim().url("Paste the YouTube link").max(300).refine((u) => !!extractYouTubeId(u), "Enter a valid YouTube link"),
  assign_all: z.boolean().default(true), // add it to everyone's list straight away
});
const uuid = z.string().uuid();

function revalidateTraining() {
  revalidatePath("/admin/training");
  revalidatePath("/admin/dashboard");
  revalidatePath("/staff");
  revalidatePath("/admin/hours");
  revalidatePath("/admin"); // the POS Manager button appears / goes
}

export async function addTrainingVideo(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = trainingVideoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form fields" };
  const { assign_all, ...video } = parsed.data;

  const { data, error } = await supabaseAdmin
    .from("training_videos")
    .insert({ ...video, created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: "Could not add video" };

  if (assign_all) {
    const { data: people } = await supabaseAdmin.from("training_people").select("id").eq("is_active", true);
    if (people?.length) await supabaseAdmin.from("training_assignments").insert(people.map((p) => ({ person_id: p.id, video_id: data.id })));
  }
  await audit({ actor_id: user.id, action: "ADD_TRAINING_VIDEO", target_table: "training_videos", target_id: data.id, new_data: parsed.data });
  revalidateTraining();
  return { ok: true };
}

export async function setTrainingVideoActive(id: string, active: boolean) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad id" };
  await supabaseAdmin.from("training_videos").update({ is_active: active }).eq("id", id);
  await audit({ actor_id: user.id, action: "TOGGLE_TRAINING_VIDEO", target_table: "training_videos", target_id: id, new_data: { active } });
  revalidateTraining();
  return { ok: true };
}

export async function deleteTrainingVideo(id: string) {
  const { user } = await requireRole(["super_admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad id" };
  await supabaseAdmin.from("training_videos").delete().eq("id", id);
  await audit({ actor_id: user.id, action: "DELETE_TRAINING_VIDEO", target_table: "training_videos", target_id: id });
  revalidateTraining();
  return { ok: true };
}

/** The training person unlocked on this login (from the PIN cookie), or null. */
export async function currentTrainee() {
  const { user } = await requireRole(STAFF_ROLES);
  const personId = verifyTrainee(user.id, (await cookies()).get(TRAINEE_COOKIE)?.value);
  if (!personId) return null;
  const { data } = await supabaseAdmin.from("training_people").select("id, name, is_active").eq("id", personId).maybeSingle();
  return data?.is_active ? { id: data.id, name: data.name } : null;
}

/** /staff PIN pad: the PIN alone says who is watching. 5 wrong tries in 15 minutes locks it for a while. */
export async function unlockTraining(pin: unknown) {
  const { user } = await requireRole(STAFF_ROLES);
  if (!isPin(pin)) return { error: "Enter your 4-digit PIN" };
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await supabaseAdmin.from("audit_logs").select("id", { count: "exact", head: true })
    .eq("action", "TRAINING_PIN_FAIL").eq("actor_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= 5) return { error: "Too many wrong PINs — wait 15 minutes, or ask the manager" };

  const { data: people } = await supabaseAdmin.from("training_people").select("id, name, pin_hash").eq("is_active", true);
  let match: { id: string; name: string } | null = null;
  for (const p of people ?? []) if (await verifyPin(pin, p.pin_hash)) { match = { id: p.id, name: p.name }; break; }
  if (!match) {
    await audit({ actor_id: user.id, action: "TRAINING_PIN_FAIL", target_table: "training_people" });
    return { error: "That PIN isn't right — try again" };
  }
  (await cookies()).set(TRAINEE_COOKIE, signTrainee(user.id, match.id), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TRAINEE_TTL_SECONDS,
  });
  await audit({ actor_id: user.id, action: "TRAINING_UNLOCK", target_table: "training_people", target_id: match.id, new_data: { name: match.name } });
  return { ok: true, name: match.name };
}

/** "Not you? Switch person" — back to the PIN pad. */
export async function lockTraining() {
  await requireRole(STAFF_ROLES);
  (await cookies()).delete(TRAINEE_COOKIE);
  revalidatePath("/staff");
  return { ok: true };
}

export async function markVideoWatched(videoId: string) {
  const { user } = await requireRole(STAFF_ROLES);
  if (!uuid.safeParse(videoId).success) return { error: "Bad id" };
  const person = await currentTrainee();
  if (!person) return { error: "Enter your PIN again, then play the last few seconds" };
  // The first finish is the one admin sees — watching again later doesn't move the date.
  const { data, error } = await supabaseAdmin
    .from("training_people_progress")
    .upsert({ person_id: person.id, video_id: videoId }, { onConflict: "person_id,video_id", ignoreDuplicates: true })
    .select("person_id");
  if (error) return { error: "Couldn't save" };
  if (data?.length) {
    await audit({ actor_id: user.id, action: "TRAINING_COMPLETED", target_table: "training_videos", target_id: videoId, new_data: { person: person.name } });
  }
  revalidateTraining();
  return { ok: true };
}

// ── Admin → Staff Training → Team ────────────────────────────────
const nameSchema = z.string().trim().min(1, "Type their name").max(40, "Keep the name under 40 characters");
const pinSchema = z.string().refine(isPin, "The PIN must be 4 digits");
const videoIdsSchema = z.array(uuid).max(200);

async function pinTaken(pin: string, exceptId?: string) {
  const { data } = await supabaseAdmin.from("training_people").select("id, pin_hash").eq("is_active", true);
  const others = (data ?? []).filter((p) => p.id !== exceptId);
  return (await Promise.all(others.map((p) => verifyPin(pin, p.pin_hash)))).some(Boolean);
}

async function setAssignments(personId: string, videoIds: string[]) {
  await supabaseAdmin.from("training_assignments").delete().eq("person_id", personId);
  if (videoIds.length) {
    await supabaseAdmin.from("training_assignments").insert([...new Set(videoIds)].map((v) => ({ person_id: personId, video_id: v })));
  }
}

export async function addTrainingPerson(input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  const parsed = z.object({ name: nameSchema, pin: pinSchema, video_ids: videoIdsSchema, pos_clock: z.boolean().default(false) }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the name and PIN" };
  if (await pinTaken(parsed.data.pin)) return { error: "Someone already uses that PIN — pick another" };
  const { data, error } = await supabaseAdmin.from("training_people")
    .insert({ name: parsed.data.name, pin_hash: hashPin(parsed.data.pin), pos_clock: parsed.data.pos_clock, created_by: user.id }).select("id").single();
  if (error || !data) return { error: "Couldn't add them" };
  await setAssignments(data.id, parsed.data.video_ids);
  await audit({ actor_id: user.id, action: "TRAINING_PERSON_ADD", target_table: "training_people", target_id: data.id,
    new_data: { name: parsed.data.name, videos: parsed.data.video_ids.length, pos_clock: parsed.data.pos_clock } });
  revalidateTraining();
  return { ok: true };
}

export async function updateTrainingPerson(id: string, input: unknown) {
  const { user } = await requireRole(["super_admin"]);
  if (!uuid.safeParse(id).success) return { error: "Bad person" };
  const parsed = z.object({
    name: nameSchema.optional(), pin: pinSchema.optional(), is_active: z.boolean().optional(), video_ids: videoIdsSchema.optional(),
    pos_clock: z.boolean().optional(),
    is_manager: z.boolean().optional(), // their PIN approves the POS manager discount (migration 038)
  }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details" };
  const { name, pin, is_active, video_ids, pos_clock, is_manager } = parsed.data;
  // A PIN handed out while they were off could now clash (salted hashes can't be compared), so they come back with a fresh one.
  if (is_active === true && !pin) return { error: "Give them a new PIN to switch them back on" };
  if (pin && await pinTaken(pin, id)) return { error: "Someone already uses that PIN — pick another" };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) patch.name = name;
  if (pin) patch.pin_hash = hashPin(pin);
  if (is_active !== undefined) patch.is_active = is_active;
  if (pos_clock !== undefined) patch.pos_clock = pos_clock;
  if (is_manager !== undefined) patch.is_manager = is_manager;
  const { error } = await supabaseAdmin.from("training_people").update(patch).eq("id", id);
  if (error) return { error: "Couldn't save" };
  if (video_ids) await setAssignments(id, video_ids);
  // Switched off or taken off the POS clock while clocked in: their PIN can't clock out any more, so end the shift now.
  if (is_active === false || pos_clock === false) await closeOpenShift(id, user.id);
  await audit({ actor_id: user.id, action: "TRAINING_PERSON_EDIT", target_table: "training_people", target_id: id,
    new_data: { name, is_active, pos_clock, is_manager, pin_changed: !!pin, videos: video_ids?.length } });
  revalidateTraining();
  return { ok: true };
}

export async function deleteTrainingPerson(id: string) {
  const { user } = await requireRole(["super_admin"]);
  if (!uuid.safeParse(id).success) return { error: "Bad person" };
  await closeOpenShift(id, user.id); // their hours stay (staff_shifts keeps the name)
  const { error } = await supabaseAdmin.from("training_people").delete().eq("id", id);
  if (error) return { error: "Couldn't remove them" };
  await audit({ actor_id: user.id, action: "TRAINING_PERSON_DELETE", target_table: "training_people", target_id: id });
  revalidateTraining();
  return { ok: true };
}
