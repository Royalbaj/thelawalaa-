import { Search, IdCard } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { nepalToday } from "@/lib/dates";
import MemberRow, { type MemberRowData } from "@/components/admin/member-row";

export const dynamic = "force-dynamic";

const sold = (iso: string) => new Date(iso).toLocaleString("en-GB", {
  timeZone: "Asia/Kathmandu", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
});

// Everyone who bought a membership card at the POS (name + number taken at the sale).
export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireRole(["super_admin"]);
  // Only plain characters reach the filter — commas/brackets would change its meaning.
  const q = ((await searchParams).q ?? "").replace(/[^\p{L}\p{N} +\-]/gu, "").trim().slice(0, 40);
  const month = `${nepalToday().slice(0, 7)}-01T00:00:00+05:45`;

  let query = supabaseAdmin.from("memberships")
    .select("id, full_name, phone, card_number, created_at, seller:profiles!memberships_sold_by_fkey(full_name), order:orders(order_number, daily_number)")
    .order("created_at", { ascending: false }).limit(300);
  if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,card_number.ilike.%${q}%`);
  const [{ data, error }, { count: total }, { count: thisMonth }] = await Promise.all([
    query,
    supabaseAdmin.from("memberships").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("memberships").select("id", { count: "exact", head: true }).gte("created_at", month),
  ]);

  const rows: MemberRowData[] = (data ?? []).map((m) => {
    const order = m.order as unknown as { order_number: string; daily_number: number | null } | null;
    return {
      id: m.id, full_name: m.full_name, phone: m.phone, card_number: m.card_number, sold: sold(m.created_at),
      soldBy: (m.seller as unknown as { full_name: string } | null)?.full_name ?? "POS",
      order: order ? (order.daily_number != null ? `#${String(order.daily_number).padStart(2, "0")}` : order.order_number) : null,
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-xl font-bold text-brand-brown"><IdCard size={20} /> Members</h1>
          <p className="text-sm text-stone-500">Taken at the POS whenever a membership card is sold. {total ?? 0} in total · {thisMonth ?? 0} this month.</p>
        </div>
        <form className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input name="q" defaultValue={q} placeholder="Search name, number or card" className="input !pl-9 text-base sm:text-sm" />
        </form>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-brand-red">Couldn&apos;t load members — refresh to try again.</p>}
      {!error && rows.length === 0 && (
        <div className="card p-8 text-center text-sm text-stone-500">
          {q ? `No member matches "${q}".` : "No membership cards sold yet. When the POS sells one, it asks for the member's name and mobile number — they'll show up here."}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="space-y-2.5 md:hidden">{rows.map((m) => <MemberRow key={m.id} m={m} />)}</div>
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs font-bold uppercase tracking-wide text-stone-500">
                <tr><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Mobile</th><th className="px-4 py-2.5">Card no.</th><th className="px-4 py-2.5">Sold</th><th className="px-4 py-2.5">By · order</th><th /></tr>
              </thead>
              <tbody>{rows.map((m) => <MemberRow key={m.id} m={m} asTableRow />)}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
