import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import TrainingVideosManager from "@/components/admin/training-videos-manager";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  await requireRole(["super_admin"]);

  const [{ data: videos }, { data: progress }] = await Promise.all([
    supabaseAdmin.from("training_videos").select("id, title, youtube_url, is_active").order("sort_order"),
    supabaseAdmin.from("staff_training_progress").select("video_id"),
  ]);

  const watchCountByVideo = new Map<string, number>();
  (progress ?? []).forEach((p) => watchCountByVideo.set(p.video_id, (watchCountByVideo.get(p.video_id) ?? 0) + 1));

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 font-display text-xl font-bold text-brand-brown">Staff Training</h1>
      <TrainingVideosManager
        videos={(videos ?? []).map((v) => ({ ...v, watchCount: watchCountByVideo.get(v.id) ?? 0 }))}
      />
    </div>
  );
}
