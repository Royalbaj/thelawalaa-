import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import TrainingList from "@/components/staff/training-list";
import { Megaphone, MessageCircle, GraduationCap } from "lucide-react";

export const dynamic = "force-dynamic";

const STAFF_ROLES = ["pos_user", "delivery_driver", "super_admin"];

export default async function StaffPortalPage() {
  const { user, profile } = await requireRole(STAFF_ROLES);

  const [{ data: videos }, { data: progress }, { data: announcements }] = await Promise.all([
    supabaseAdmin.from("training_videos").select("id, title, youtube_url").eq("is_active", true).order("sort_order"),
    supabaseAdmin.from("staff_training_progress").select("video_id").eq("staff_id", user.id),
    supabaseAdmin
      .from("announcements")
      .select("message, link_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const completedIds = (progress ?? []).map((p) => p.video_id);

  return (
    <div className="space-y-6 p-4 pb-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-brown">Staff Portal</h1>
        <p className="text-sm text-stone-500">Hi {profile.full_name.split(" ")[0]} — training and updates for the team.</p>
      </div>

      {(announcements ?? []).length > 0 && (
        <section className="card space-y-2 p-4">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-brand-brown"><Megaphone size={16} /> Announcements</h2>
          {(announcements ?? []).map((a, i) => (
            a.link_url ? (
              <a key={i} href={a.link_url} target="_blank" rel="noopener noreferrer" className="block text-sm text-stone-600 underline">{a.message}</a>
            ) : (
              <p key={i} className="text-sm text-stone-600">{a.message}</p>
            )
          ))}
        </section>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-1.5 font-bold text-brand-brown"><GraduationCap size={18} /> Training videos</h2>
        <TrainingList videos={(videos ?? []) as never} completedIds={completedIds} />
      </section>

      <a
        href="https://wa.me/9779801011111"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-outline flex w-full items-center justify-center gap-2 !border-stone-300 !text-brand-brown hover:!bg-stone-100"
      >
        <MessageCircle size={16} /> Message the office
      </a>
    </div>
  );
}
