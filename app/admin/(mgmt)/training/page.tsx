import { requireRole } from "@/lib/supabase/server";
import { getTrainingStatus } from "@/lib/training-status";
import TrainingPeople from "@/components/admin/training-people";
import TrainingVideosManager from "@/components/admin/training-videos-manager";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  await requireRole(["super_admin"]);
  const { videos, team } = await getTrainingStatus();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-xl font-bold text-brand-brown">Staff Training</h1>
      <TrainingPeople team={team} videos={videos.map(({ id, title, is_active }) => ({ id, title, is_active }))} />
      <TrainingVideosManager videos={videos} />
    </div>
  );
}
