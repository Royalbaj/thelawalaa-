import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cleanFeatures } from "@/lib/pos-features";
import { ACCOUNTS_URL } from "@/lib/role-home";
import PosPeople from "@/components/admin/pos-team/people";
import PosRoles from "@/components/admin/pos-team/roles";

export const dynamic = "force-dynamic";

// Admin → POS team & roles (migration 051): who can use the POS, their PIN
// and role, and what each role allows. The outlet's own records (expenses,
// issues, stock, approvals) are in the Accounts app's POS section.
export default async function PosTeamPage() {
  await requireRole(["super_admin"]);
  const [{ data: roles }, { data: people }, { data: videos }] = await Promise.all([
    supabaseAdmin.from("pos_roles").select("id, name, features, sort_order").order("sort_order").order("name"),
    supabaseAdmin.from("training_people").select("id, name, pos_clock, role_id").eq("is_active", true).order("name"),
    supabaseAdmin.from("training_videos").select("id").eq("is_active", true),
  ]);
  const count = (id: string) => (people ?? []).filter((p) => p.role_id === id).length;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold text-brand-brown">POS team &amp; roles</h1>
        <p className="text-sm text-stone-500">
          Who can use the POS, their PIN, and what their role lets them do — a change shows on the till within a minute. Day expenses, issues, stock added on the POS and changes waiting
          for approval are in <a href={`${ACCOUNTS_URL}/pos`} target="_blank" rel="noopener noreferrer" className="font-bold text-brand-orange">Accounts → POS</a>.
        </p>
      </div>
      <PosPeople people={people ?? []} roles={(roles ?? []).map(({ id, name }) => ({ id, name }))} videoIds={(videos ?? []).map((v) => v.id)} />
      <PosRoles roles={(roles ?? []).map((r) => ({ id: r.id, name: r.name, features: cleanFeatures(r.features), people: count(r.id) }))} />
    </div>
  );
}
