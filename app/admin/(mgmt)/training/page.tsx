import { CheckCircle2, Clock } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import { getTrainingStatus } from "@/lib/training-status";
import TrainingVideosManager from "@/components/admin/training-videos-manager";

export const dynamic = "force-dynamic";

export default async function TrainingPage() {
  await requireRole(["super_admin"]);
  const { videos, activeCount, team } = await getTrainingStatus();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-xl font-bold text-brand-brown">Staff Training</h1>

      {activeCount > 0 && (
        <section className="card p-5">
          <h3 className="font-display font-bold text-brand-brown">Who has finished</h3>
          <p className="text-xs text-stone-500">Active POS and delivery staff, against the videos that are switched on.</p>
          <div className="mt-3 divide-y divide-orange-50">
            {team.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{t.name}</p>
                  {t.missing.length > 0 && <p className="text-xs text-stone-500">Still to watch: {t.missing.join(", ")}</p>}
                </div>
                {t.missing.length === 0 ? (
                  <span className="badge shrink-0 gap-1 bg-green-100 text-green-800"><CheckCircle2 size={12} /> All done</span>
                ) : (
                  <span className="badge shrink-0 gap-1 bg-amber-100 text-amber-800"><Clock size={12} /> {t.done} of {activeCount}</span>
                )}
              </div>
            ))}
            {team.length === 0 && <p className="py-2 text-sm text-stone-400">No active POS or delivery staff yet.</p>}
          </div>
        </section>
      )}

      <TrainingVideosManager videos={videos} />
    </div>
  );
}
