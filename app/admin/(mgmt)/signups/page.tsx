import { format } from "date-fns";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CustomerRowActions } from "@/components/admin/staff-controls";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  web: "Website",
  qr_poster: "QR Poster",
};

export default async function SignupsPage({ searchParams }: { searchParams: { q?: string; source?: string } }) {
  await requireRole(["super_admin"]);
  const q = (searchParams.q ?? "").slice(0, 60);
  const source = searchParams.source ?? "all";

  let query = supabaseAdmin
    .from("profiles")
    .select("id, full_name, phone, is_active, signup_source, created_at")
    .eq("role", "customer")
    .order("created_at", { ascending: false })
    .limit(300);
  if (q) query = query.ilike("full_name", `%${q}%`);
  if (source !== "all") query = query.eq("signup_source", source);
  const { data: customers } = await query;

  const { count: totalCustomers } = await supabaseAdmin
    .from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer");
  const { count: qrCustomers } = await supabaseAdmin
    .from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer").eq("signup_source", "qr_poster");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-orange-100">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Total Customers</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-brown">{totalCustomers ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-orange-100">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Via QR Poster</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-brown">{qrCustomers ?? 0}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action="/admin/signups" className="flex gap-2">
          <input type="hidden" name="source" value={source} />
          <input name="q" defaultValue={q} placeholder="Search by name…" className="input !w-56" />
        </form>
        <div className="flex gap-2">
          {(["all", "web", "qr_poster"] as const).map((s) => (
            <a key={s} href={`/admin/signups?source=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${source === s ? "bg-brand-orange text-white" : "bg-white text-stone-600 border border-orange-100 hover:bg-orange-50"}`}>
              {s === "all" ? "All" : SOURCE_LABEL[s]}
            </a>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-white shadow-sm border border-orange-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-orange-100 text-left text-xs uppercase text-stone-400 bg-orange-50/50">
              <th className="px-4 py-3.5 font-bold">Name</th>
              <th className="px-4 py-3.5 font-bold">Phone</th>
              <th className="px-4 py-3.5 font-bold">Source</th>
              <th className="px-4 py-3.5 font-bold">Joined</th>
              <th className="px-4 py-3.5 font-bold">Status</th>
              <th className="px-4 py-3.5 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(customers ?? []).map((c) => (
              <tr key={c.id} className="border-b border-orange-50 last:border-0 hover:bg-orange-50/40 transition-colors">
                <td className="px-4 py-3.5 font-medium text-brand-brown">{c.full_name}</td>
                <td className="px-4 py-3.5 text-stone-500">{c.phone ?? "—"}</td>
                <td className="px-4 py-3.5">
                  <span className={`badge ${c.signup_source === "qr_poster" ? "bg-orange-100 text-brand-orange" : "bg-stone-100 text-stone-600"}`}>
                    {SOURCE_LABEL[c.signup_source] ?? c.signup_source}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-stone-500 text-xs">{format(new Date(c.created_at), "d MMM yyyy")}</td>
                <td className="px-4 py-3.5">
                  {c.is_active ? <span className="badge bg-green-100 text-green-800">Active</span> : <span className="badge bg-red-100 text-red-800">Suspended</span>}
                </td>
                <td className="px-4 py-3.5"><CustomerRowActions userId={c.id} isActive={c.is_active} /></td>
              </tr>
            ))}
            {(customers ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-stone-500">No signups found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
