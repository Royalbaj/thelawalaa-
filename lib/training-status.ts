import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Who has watched which training video — for Admin → Training and the
// dashboard card. The team expected to train is active POS + delivery staff;
// an admin who watched still shows up under "watched".
const TRAINEE_ROLES = ["pos_user", "delivery_driver"];

const nepalTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Kathmandu", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });

export type TrainingVideoStatus = {
  id: string; title: string; youtube_url: string; is_active: boolean;
  watched: { name: string; at: string }[];
  notYet: string[];
};
export type TraineeStatus = { id: string; name: string; done: number; missing: string[] };

export async function getTrainingStatus() {
  const [{ data: videos }, { data: progress }, { data: staff }] = await Promise.all([
    supabaseAdmin.from("training_videos").select("id, title, youtube_url, is_active").order("sort_order").order("created_at"),
    supabaseAdmin.from("staff_training_progress").select("staff_id, video_id, completed_at").order("completed_at"),
    supabaseAdmin.from("profiles").select("id, full_name, role, is_active").in("role", [...TRAINEE_ROLES, "super_admin"]),
  ]);
  const nameOf = new Map((staff ?? []).map((p) => [p.id, p.full_name || "Unnamed"]));
  const trainees = (staff ?? []).filter((p) => p.is_active && TRAINEE_ROLES.includes(p.role));
  const watched = new Set((progress ?? []).map((p) => `${p.staff_id}:${p.video_id}`));

  const allVideos: TrainingVideoStatus[] = (videos ?? []).map((v) => ({
    ...v,
    watched: (progress ?? [])
      .filter((p) => p.video_id === v.id)
      .map((p) => ({ name: nameOf.get(p.staff_id) ?? "Former staff", at: nepalTime(p.completed_at) })),
    notYet: trainees.filter((t) => !watched.has(`${t.id}:${v.id}`)).map((t) => t.full_name || "Unnamed"),
  }));
  const active = allVideos.filter((v) => v.is_active);
  const team: TraineeStatus[] = trainees.map((t) => {
    const missing = active.filter((v) => !watched.has(`${t.id}:${v.id}`)).map((v) => v.title);
    return { id: t.id, name: t.full_name || "Unnamed", done: active.length - missing.length, missing };
  });

  return { videos: allVideos, activeCount: active.length, team };
}
