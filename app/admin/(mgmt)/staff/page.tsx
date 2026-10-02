import { format } from "date-fns";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { InviteStaffForm, StaffRowActions } from "@/components/admin/staff-controls";
import AccountsPeople from "@/components/admin/accounts-people";

export const dynamic = "force-dynamic";

const ROLE_BADGE: Record<string, string> = {
  super_admin: "bg-brand-red/10 text-brand-red",
  pos_user: "bg-blue-100 text-blue-800",
  delivery_driver: "bg-purple-100 text-purple-800",
  accountant: "bg-amber-100 text-amber-800",
};

export default async function StaffPage(props: { searchParams: Promise<{ q?: string }> }) {
  await requireRole(["super_admin"]);
  const searchParams = await props.searchParams;
  const q = (searchParams.q ?? "").slice(0, 60);

  let query = supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone, role, is_active, branch_id, invite_accepted_at, created_at, branches:branch_id(name)")
    .neq("role", "customer")
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) query = query.ilike("full_name", `%${q}%`);
  const [{ data: staff }, { data: branches }, { data: accountsPeople }] = await Promise.all([
    query,
    supabaseAdmin.from("branches").select("id, name").eq("is_active", true),
    supabaseAdmin.from("account_users").select("id, name, is_active, created_at").order("is_active", { ascending: false }).order("name"),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <form action="/admin/staff"><input name="q" defaultValue={q} placeholder="Search by name…" className="input text-base sm:!w-64 sm:text-sm" /></form>
        <section>
          <h2 className="mb-2 font-display font-bold text-brand-brown">Staff</h2>
          {/* Phones: one card per person */}
          <div className="space-y-2.5 md:hidden">
            {(staff ?? []).map((p: any) => (
              <div key={p.id} className="card space-y-2 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold">{p.full_name}</p>
                    <p className="text-xs text-stone-500">{p.phone ?? "No phone"} · {p.branches?.name ?? "No branch"} · joined {format(new Date(p.created_at), "d MMM yyyy")}</p>
                  </div>
                  <span className={cn("badge shrink-0", ROLE_BADGE[p.role])}>{p.role}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {!p.is_active ? <span className="badge bg-red-100 text-red-800">Suspended</span>
                    : !p.invite_accepted_at ? <span className="badge bg-yellow-100 text-yellow-800">Invite pending</span>
                    : <span className="badge bg-green-100 text-green-800">Active</span>}
                  <StaffRowActions userId={p.id} isActive={p.is_active} role={p.role} branches={(branches ?? []) as never} inviteAccepted={!!p.invite_accepted_at} />
                </div>
              </div>
            ))}
            {(staff ?? []).length === 0 && <div className="card px-4 py-8 text-center text-stone-500">No staff yet.</div>}
          </div>
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orange-100 text-left text-xs uppercase text-stone-500">
                  <th className="px-4 py-3">Name</th><th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Role</th><th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Status</th><th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(staff ?? []).map((p: any) => (
                  <tr key={p.id} className="border-b border-orange-50 last:border-0">
                    <td className="px-4 py-3 font-bold">{p.full_name}</td>
                    <td className="px-4 py-3 text-stone-500">{p.phone ?? "—"}</td>
                    <td className="px-4 py-3"><span className={cn("badge", ROLE_BADGE[p.role])}>{p.role}</span></td>
                    <td className="px-4 py-3">{p.branches?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {!p.is_active ? <span className="badge bg-red-100 text-red-800">Suspended</span>
                        : !p.invite_accepted_at ? <span className="badge bg-yellow-100 text-yellow-800">Invite pending</span>
                        : <span className="badge bg-green-100 text-green-800">Active</span>}
                    </td>
                    <td className="px-4 py-3 text-stone-500">{format(new Date(p.created_at), "d MMM yyyy")}</td>
                    <td className="px-4 py-3">
                      <StaffRowActions userId={p.id} isActive={p.is_active} role={p.role} branches={(branches ?? []) as never} inviteAccepted={!!p.invite_accepted_at} />
                    </td>
                  </tr>
                ))}
                {(staff ?? []).length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-500">No staff yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <div className="space-y-6">
        <InviteStaffForm branches={(branches ?? []) as never} />
        <AccountsPeople people={accountsPeople ?? []} />
      </div>
    </div>
  );
}
