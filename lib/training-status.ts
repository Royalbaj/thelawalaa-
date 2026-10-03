import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Who has watched which training video — for Admin → Staff Training and the
// dashboard card. Training is per PERSON (training_people, migration 028):
// each has their own PIN and their own list of videos to watch.

const nepalTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Kathmandu", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });

export type TrainingVideoStatus = {
  id: string; title: string; youtube_url: string; is_active: boolean;
  watched: { name: string; at: string }[];
  notYet: string[];
};
export type TraineeStatus = {
  id: string; name: string; is_active: boolean;
  videoIds: string[];                         // assigned (on or off)
  done: number; total: number;                // of their assigned videos that are switched on
  missing: string[];
  watched: { title: string; at: string }[];
};

export async function getTrainingStatus() {
  const [{ data: videos }, { data: people }, { data: assigned }, { data: progress }] = await Promise.all([
    supabaseAdmin.from("training_videos").select("id, title, youtube_url, is_active").order("sort_order").order("created_at"),
    supabaseAdmin.from("training_people").select("id, name, is_active").order("name"),
    supabaseAdmin.from("training_assignments").select("person_id, video_id"),
    supabaseAdmin.from("training_people_progress").select("person_id, video_id, completed_at").order("completed_at"),
  ]);
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.name]));
  const titleOf = new Map((videos ?? []).map((v) => [v.id, v.title]));
  const activeVideo = new Set((videos ?? []).filter((v) => v.is_active).map((v) => v.id));
  const watchedAt = new Map((progress ?? []).map((p) => [`${p.person_id}:${p.video_id}`, p.completed_at]));
  const activePeople = (people ?? []).filter((p) => p.is_active);

  const allVideos: TrainingVideoStatus[] = (videos ?? []).map((v) => ({
    ...v,
    watched: (progress ?? []).filter((p) => p.video_id === v.id && nameOf.has(p.person_id))
      .map((p) => ({ name: nameOf.get(p.person_id)!, at: nepalTime(p.completed_at) })),
    notYet: activePeople
      .filter((p) => (assigned ?? []).some((a) => a.person_id === p.id && a.video_id === v.id) && !watchedAt.has(`${p.id}:${v.id}`))
      .map((p) => p.name),
  }));

  const team: TraineeStatus[] = (people ?? []).map((p) => {
    const videoIds = (assigned ?? []).filter((a) => a.person_id === p.id).map((a) => a.video_id);
    const due = videoIds.filter((id) => activeVideo.has(id));
    const missing = due.filter((id) => !watchedAt.has(`${p.id}:${id}`)).map((id) => titleOf.get(id) ?? "Video");
    return {
      id: p.id, name: p.name, is_active: p.is_active, videoIds,
      done: due.length - missing.length, total: due.length, missing,
      watched: videoIds.filter((id) => watchedAt.has(`${p.id}:${id}`))
        .map((id) => ({ title: titleOf.get(id) ?? "Video", at: nepalTime(watchedAt.get(`${p.id}:${id}`)!) })),
    };
  });

  return {
    videos: allVideos,
    activeCount: activeVideo.size,
    team,
    // The people expected to train right now: switched on, with at least one video to watch.
    trainees: team.filter((t) => t.is_active && t.total > 0),
  };
}
