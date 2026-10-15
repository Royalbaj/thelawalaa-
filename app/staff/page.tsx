import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentTrainee } from "@/app/actions/training";
import TrainingCourse, { type CourseVideo } from "@/components/staff/training-course";
import TrainingPinPad from "@/components/staff/training-pin-pad";
import { getSiteText, whatsappHref } from "@/lib/site-content";
import { WhatsAppGlyph } from "@/components/icons/brand-glyphs";

export const dynamic = "force-dynamic";

const STAFF_ROLES = ["pos_user", "delivery_driver", "super_admin"];
const NEW_FOR_DAYS = 7;

type Row = {
  created_at: string;
  training_videos: { id: string; title: string; youtube_url: string; is_active: boolean; sort_order: number | null; created_at: string } | null;
};

export default async function StaffPortalPage() {
  const { profile } = await requireRole(STAFF_ROLES);
  // The login is shared at the counter: training belongs to whoever typed their PIN.
  const [siteText, trainee] = await Promise.all([getSiteText(), currentTrainee()]);

  const [{ data: assigned }, { data: progress }, { data: announcements }] = await Promise.all([
    trainee
      ? supabaseAdmin.from("training_assignments")
          .select("created_at, training_videos(id, title, youtube_url, is_active, sort_order, created_at)")
          .eq("person_id", trainee.id)
      : Promise.resolve({ data: [] as Row[] }),
    trainee
      ? supabaseAdmin.from("training_people_progress").select("video_id, completed_at").eq("person_id", trainee.id)
      : Promise.resolve({ data: [] as { video_id: string; completed_at: string }[] }),
    supabaseAdmin
      .from("announcements")
      .select("message, link_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  // Newest first (owner's call): a video counts as new to someone from when it was
  // added or given to them, whichever is later; a video added the same moment
  // keeps the manager's order.
  const finished = new Map((progress ?? []).map((p) => [p.video_id, p.completed_at]));
  const now = Date.now();
  const videos: CourseVideo[] = ((assigned ?? []) as unknown as Row[])
    .filter((a) => a.training_videos?.is_active)
    .map((a) => {
      const v = a.training_videos!;
      const addedAt = new Date(Math.max(Date.parse(v.created_at), Date.parse(a.created_at))).toISOString();
      return {
        id: v.id, title: v.title, youtubeUrl: v.youtube_url, addedAt, sortOrder: v.sort_order ?? 0,
        completedAt: finished.get(v.id) ?? null,
        isNew: now - Date.parse(addedAt) < NEW_FOR_DAYS * 86_400_000,
      };
    })
    .sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt) || a.sortOrder - b.sortOrder);

  const firstName = trainee?.name.split(" ")[0];

  return (
    <div className="space-y-8 px-4 pb-14 pt-7 sm:px-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-orange">Staff training</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-brand-brown dark:text-orange-50">
          {firstName ? `Hi, ${firstName}` : "Staff Portal"}
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {trainee ? "Your training videos and the latest from the office." : `Signed in as ${profile.full_name} — type your PIN to see your training.`}
        </p>
      </div>

      {(announcements ?? []).length > 0 && (
        <section aria-labelledby="notices" className="card p-5">
          <h2 id="notices" className="text-xs font-bold uppercase tracking-[0.2em] text-stone-400">From the office</h2>
          <ul className="mt-3 space-y-3">
            {(announcements ?? []).map((a, i) => (
              <li key={i} className="border-l-2 border-brand-orange pl-3 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                {a.link_url ? (
                  <a href={a.link_url} target="_blank" rel="noopener noreferrer" className="underline decoration-brand-orange/50 underline-offset-4 hover:text-brand-orange">{a.message}</a>
                ) : a.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      {trainee ? <TrainingCourse videos={videos} name={trainee.name} /> : <TrainingPinPad />}

      <a
        href={whatsappHref(siteText)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-stone-200 px-6 py-3.5 font-bold text-brand-brown transition hover:border-[#25D366] hover:text-[#128C7E] dark:border-stone-800 dark:text-orange-100 dark:hover:border-[#25D366]"
      >
        <WhatsAppGlyph size={18} /> Message the office
      </a>
    </div>
  );
}
