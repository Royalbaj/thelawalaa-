import { format } from "date-fns";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { AnnouncementForm, AnnouncementToggle } from "@/components/admin/announcement-controls";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  await requireRole(["super_admin"]);
  const { data: rows } = await supabaseAdmin
    .from("announcements")
    .select("id, message, link_url, is_active, ends_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card divide-y divide-orange-50 lg:col-span-2">
        {(rows ?? []).map((a) => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-bold">{a.message}</p>
              <p className="text-xs text-stone-500">
                {format(new Date(a.created_at), "d MMM yyyy")}
                {a.ends_at && ` · ends ${format(new Date(a.ends_at), "d MMM, h:mm a")}`}
              </p>
            </div>
            <AnnouncementToggle id={a.id} active={a.is_active} />
          </div>
        ))}
        {(rows ?? []).length === 0 && <p className="px-4 py-8 text-center text-sm text-stone-500">No announcements yet.</p>}
      </div>
      <AnnouncementForm />
    </div>
  );
}
