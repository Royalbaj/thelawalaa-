import { format } from "date-fns";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import { InviteStaffForm, StaffRowActions } from "@/components/admin/staff-controls";

export const dynamic = "force-dynamic";

const ROLE_BADGE: Record<string, string> = {
  super_admin: "bg-amber-100 text-amber-700",
  admin: "bg-brand-red/10 text-brand-red",
  pos_user: "bg-blue-100 text-blue-800",
  delivery_driver: "bg-purple-100 text-purple-800",
  customer: "bg-stone-100 text-stone-600",
};

export default async function StaffPage({ searchParams }: { searchParams: { q?: string } }) {
  await requireRole(["admin"]);
  const q = (searchParams.q ?? "").slice(0, 60);

  let query = supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone, role, is_active, branch_id, invite_accepted_at, created_at, branches:branch_id(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (q) query = query.ilike("full_name", `%${q}%`);
  const [{ data: people }, { data: branches }] = await Promise.all([
    query,
    supabaseAdmin.from("branches").select("id, name").eq("is_active", true),
  ]);

  const staff = (people ?? []).filter((p) => p.role !== "customer");
  const customers = (people ?? []).filter((p) => p.role === "customer");

  const Table = ({ rows, showActions }: { rows: typeof staff; showActions: boolean }) => (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-orange-100 text-left text-xs uppercase text-stone-500">
            <th className="px-4 py-3">Name</th><th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">Role</th><th className="px-4 py-3">Branch</th>
            <th className="px-4 py-3">Status</th><th className="px-4 py-3">Joined</th>
            {showActions && <th className="px-4 py-3">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((p: any) => (
            <tr key={p.id} className="border-b border-orange-50 last:border-0">
              <td className="px-4 py-3 font-bold">{p.full_name}</td>
              <td className="px-4 py-3 text-stone-500">{p.phone ?? "—"}</td>
              <td className="px-4 py-3"><span className={cn("badge", ROLE_BADGE[p.role])}>{p.role}</span></td>
              <td className="px-4 py-3">{p.branches?.name ?? "—"}</td>
              <td className="px-4 py-3">
                {!p.is_active ? <span className="badge bg-red-100 text-red-800">Suspended</span>
                  : p.role !== "customer" && !p.invite_accepted_at ? <span className="badge bg-yellow-100 text-yellow-800">Invite pending</span>
                  : <span className="badge bg-green-100 text-green-800">Active</span>}
              </td>
              <td className="px-4 py-3 text-stone-500">{format(new Date(p.created_at), "d MMM yyyy")}</td>
              {showActions && (
                <td className="px-4 py-3">
                  {p.role === "admin"
                    ? <span className="text-xs text-stone-400">Manage in Supabase</span>
                    : <StaffRowActions userId={p.id} isActive={p.is_active} role={p.role} branches={(branches ?? []) as never} />}
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-500">No one here.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <form action="/admin/staff"><input name="q" defaultValue={q} placeholder="Search by name…" className="input !w-64" /></form>
        <section>
          <h2 className="mb-2 font-display font-bold text-brand-brown">Staff</h2>
          <Table rows={staff} showActions />
        </section>
        <section>
          <h2 className="mb-2 font-display font-bold text-brand-brown">Customers</h2>
          <Table rows={customers} showActions />
        </section>
      </div>
      <InviteStaffForm branches={(branches ?? []) as never} />
    </div>
  );
}
