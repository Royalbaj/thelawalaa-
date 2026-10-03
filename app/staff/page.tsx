import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentTrainee } from "@/app/actions/training";
import TrainingList from "@/components/staff/training-list";
import TrainingPinPad from "@/components/staff/training-pin-pad";
import SwitchTrainee from "@/components/staff/switch-trainee";
import { getSiteText, whatsappHref } from "@/lib/site-content";
import { Megaphone, MessageCircle, GraduationCap } from "lucide-react";

export const dynamic = "force-dynamic";

const STAFF_ROLES = ["pos_user", "delivery_driver", "super_admin"];

export default async function StaffPortalPage() {
  const { profile } = await requireRole(STAFF_ROLES);
  // The login is shared at the counter: training belongs to whoever typed their PIN.
  const [siteText, trainee] = await Promise.all([getSiteText(), currentTrainee()]);

  const [{ data: assigned }, { data: progress }, { data: announcements }] = await Promise.all([
    trainee
      ? supabaseAdmin.from("training_assignments").select("training_videos(id, title, youtube_url, is_active, sort_order)").eq("person_id", trainee.id)
      : Promise.resolve({ data: [] as { training_videos: unknown }[] }),
    trainee
      ? supabaseAdmin.from("training_people_progress").select("video_id").eq("person_id", trainee.id)
      : Promise.resolve({ data: [] as { video_id: string }[] }),
    supabaseAdmin
      .from("announcements")
      .select("message, link_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const completedIds = (progress ?? []).map((p) => p.video_id);
  type V = { id: string; title: string; youtube_url: string; is_active: boolean; sort_order: number | null };
  const videos = (assigned ?? []).map((a) => a.training_videos as unknown as V | null)
    .filter((v): v is V => !!v?.is_active)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <div className="space-y-6 p-4 pb-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-brown dark:text-orange-100">Staff Portal</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">{trainee ? `Hi ${trainee.name}` : `Signed in as ${profile.full_name}`} — training and updates for the team.</p>
      </div>

      {(announcements ?? []).length > 0 && (
        <section className="card space-y-2 p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-brand-brown dark:text-orange-100"><Megaphone size={16} /> Announcements</h2>
          {(announcements ?? []).map((a, i) => (
            a.link_url ? (
              <a key={i} href={a.link_url} target="_blank" rel="noopener noreferrer" className="block text-sm text-stone-600 underline dark:text-stone-300">{a.message}</a>
            ) : (
              <p key={i} className="text-sm text-stone-600 dark:text-stone-300">{a.message}</p>
            )
          ))}
        </section>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-1.5 font-bold text-brand-brown dark:text-orange-100"><GraduationCap size={18} /> Training videos</h2>
        {trainee ? (
          <div className="space-y-4">
            <SwitchTrainee name={trainee.name} />
            <TrainingList videos={videos} completedIds={completedIds} />
          </div>
        ) : (
          <TrainingPinPad />
        )}
      </section>

      <a
        href={whatsappHref(siteText)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-outline flex w-full items-center justify-center gap-2 !border-stone-300 !text-brand-brown hover:!bg-stone-100 dark:!border-stone-700 dark:!text-orange-100 dark:hover:!bg-stone-900"
      >
        <MessageCircle size={16} /> Message the office
      </a>
    </div>
  );
}
