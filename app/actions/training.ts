"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin, audit } from "@/lib/supabase/admin";
import { extractYouTubeId } from "@/lib/youtube";

const STAFF_ROLES = ["pos_user", "delivery_driver", "admin"];

const trainingVideoSchema = z.object({
  title: z.string().trim().min(2).max(100),
  youtube_url: z.string().trim().url().max(300).refine((u) => !!extractYouTubeId(u), "Enter a valid YouTube link"),
});

export async function addTrainingVideo(input: unknown) {
  const { user } = await requireRole(["admin"]);
  const parsed = trainingVideoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form fields" };

  const { data, error } = await supabaseAdmin
    .from("training_videos")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: "Could not add video" };

  await audit({ actor_id: user.id, action: "ADD_TRAINING_VIDEO", target_table: "training_videos", target_id: data.id, new_data: parsed.data });
  revalidatePath("/admin/training");
  revalidatePath("/staff");
  return { ok: true };
}

export async function setTrainingVideoActive(id: string, active: boolean) {
  const { user } = await requireRole(["admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad id" };
  await supabaseAdmin.from("training_videos").update({ is_active: active }).eq("id", id);
  await audit({ actor_id: user.id, action: "TOGGLE_TRAINING_VIDEO", target_table: "training_videos", target_id: id, new_data: { active } });
  revalidatePath("/admin/training");
  revalidatePath("/staff");
  return { ok: true };
}

export async function deleteTrainingVideo(id: string) {
  const { user } = await requireRole(["admin"]);
  if (!z.string().uuid().safeParse(id).success) return { error: "Bad id" };
  await supabaseAdmin.from("training_videos").delete().eq("id", id);
  await audit({ actor_id: user.id, action: "DELETE_TRAINING_VIDEO", target_table: "training_videos", target_id: id });
  revalidatePath("/admin/training");
  revalidatePath("/staff");
  return { ok: true };
}

export async function markVideoWatched(videoId: string) {
  const { user } = await requireRole(STAFF_ROLES);
  if (!z.string().uuid().safeParse(videoId).success) return { error: "Bad id" };
  await supabaseAdmin
    .from("staff_training_progress")
    .upsert({ staff_id: user.id, video_id: videoId, completed_at: new Date().toISOString() }, { onConflict: "staff_id,video_id" });
  revalidatePath("/staff");
  revalidatePath("/admin/training");
  return { ok: true };
}
