import Link from "next/link";
import { Trophy, Medal, Crown, Users } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { nepalToday, addDays, prettyDate } from "@/lib/dates";
import { npr, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Top ordering customers (signed-in accounts). Counts orders the way Admin →
// Reports does: paid and not cancelled. Walk-in / guest orders have no
// account, so they can't be on it.

const PERIODS = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "3 months", days: 90 },
  { key: "all", label: "All time", days: 0 },
] as const;
const SORTS = [
  { key: "orders", label: "Most orders" },
  { key: "spent", label: "Most spent" },
] as const;

type Entry = { id: string; orders: number; spent: number; last: string };

export default async function LeaderboardPage(props: { searchParams: Promise<{ period?: string; sort?: string }> }) {
  await requireRole(["super_admin"]);
  const sp = await props.searchParams;
  const period = PERIODS.find((p) => p.key === sp.period) ?? PERIODS[1];
  const sort = SORTS.find((s) => s.key === sp.sort) ?? SORTS[0];
  const since = period.days ? `${addDays(nepalToday(), -(period.days - 1))}T00:00:00+05:45` : null;

  let q = supabaseAdmin.from("orders").select("customer_id, total, created_at")
    .not("customer_id", "is", null).eq("payment_status", "paid").neq("status", "cancelled")
    .order("created_at", { ascending: false }).limit(20000);
  if (since) q = q.gte("created_at", since);
  const { data: orders } = await q;

  const byCustomer = new Map<string, Entry>();
  for (const o of orders ?? []) {
    const id = o.customer_id as string;
    const e = byCustomer.get(id) ?? { id, orders: 0, spent: 0, last: o.created_at };
    e.orders += 1;
    e.spent += Number(o.total);
    if (o.created_at > e.last) e.last = o.created_at;
    byCustomer.set(id, e);
  }
  const ranked = [...byCustomer.values()]
    .sort((a, b) => sort.key === "spent" ? b.spent - a.spent || b.orders - a.orders : b.orders - a.orders || b.spent - a.spent)
    .slice(0, 50);

  const { data: people } = ranked.length
    ? await supabaseAdmin.from("profiles").select("id, full_name, phone, marketing_opt_in, role").in("id", ranked.map((r) => r.id))
    : { data: [] };
  const who = new Map((people ?? []).map((p) => [p.id, p]));
  const rows = ranked.filter((r) => who.get(r.id)?.role === "customer").map((r, i) => ({ ...r, rank: i + 1, p: who.get(r.id)! }));
  const totalCustomers = byCustomer.size;
  const totalOrders = (orders ?? []).length;

  const link = (patch: { period?: string; sort?: string }) => {
    const params = new URLSearchParams({ period: patch.period ?? period.key, sort: patch.sort ?? sort.key });
    return `/admin/leaderboard?${params}`;
  };
  const when = (iso: string) => prettyDate(new Date(new Date(iso).getTime() + 5.75 * 3600_000).toISOString().slice(0, 10));
  const podium = rows.slice(0, 3);
  const icons = [Crown, Trophy, Medal];
  const podiumTint = ["from-amber-400 to-yellow-500", "from-stone-300 to-stone-400", "from-orange-300 to-amber-600"];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-brown">Customer leaderboard</h1>
          <p className="mt-0.5 text-sm text-stone-500">Your top ordering customers — paid, not-cancelled orders from signed-in accounts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-full bg-white p-1 ring-1 ring-stone-200">
            {PERIODS.map((p) => (
              <Link key={p.key} href={link({ period: p.key })}
                className={cn("rounded-full px-3 py-1.5 text-xs font-bold transition", p.key === period.key ? "bg-brand-orange text-white" : "text-stone-500 hover:text-brand-brown")}>{p.label}</Link>
            ))}
          </div>
          <div className="flex rounded-full bg-white p-1 ring-1 ring-stone-200">
            {SORTS.map((s) => (
              <Link key={s.key} href={link({ sort: s.key })}
                className={cn("rounded-full px-3 py-1.5 text-xs font-bold transition", s.key === sort.key ? "bg-brand-brown text-white" : "text-stone-500 hover:text-brand-brown")}>{s.label}</Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Customers who ordered</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-brown">{totalCustomers}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Their orders</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-brown">{totalOrders}</p>
        </div>
        <div className="col-span-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-100 sm:col-span-1">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Period</p>
          <p className="mt-1 font-display text-lg font-bold text-brand-brown">{since ? `Since ${prettyDate(since.slice(0, 10))}` : "All time"}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-white px-4 py-14 text-center shadow-sm ring-1 ring-stone-100">
          <Users size={30} className="mx-auto mb-2 text-stone-300" />
          <p className="font-bold text-stone-500">No paid orders from signed-in customers in this period yet</p>
          <p className="mt-1 text-xs text-stone-400">Orders count once they&apos;re marked paid.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {podium.map((r, i) => {
              const Icon = icons[i];
              return (
                <div key={r.id} className="relative overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-100">
                  <span className={cn("absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow", podiumTint[i])}><Icon size={20} /></span>
                  <p className="text-xs font-extrabold uppercase tracking-widest text-stone-400">#{r.rank}</p>
                  <p className="mt-1 pr-12 font-display text-lg font-bold text-brand-brown">{r.p.full_name}</p>
                  <p className="text-xs text-stone-500">{r.p.phone ?? "—"}</p>
                  <div className="mt-3 flex items-end gap-4">
                    <div><p className="font-display text-2xl font-extrabold text-brand-orange">{r.orders}</p><p className="text-[11px] font-bold text-stone-400">orders</p></div>
                    <div><p className="font-display text-lg font-bold text-brand-brown">{npr(r.spent)}</p><p className="text-[11px] font-bold text-stone-400">spent</p></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Phones: cards */}
          <ul className="space-y-2 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-stone-100">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-sm font-extrabold text-brand-orange">{r.rank}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-brand-brown">{r.p.full_name}</p>
                  <p className="text-xs text-stone-500">{r.orders} orders · {npr(r.spent)} · last {when(r.last)}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* Tablets and up: table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-stone-100 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/50 text-left text-xs uppercase text-stone-400">
                  <th className="px-4 py-3 font-bold">#</th>
                  <th className="px-4 py-3 font-bold">Customer</th>
                  <th className="px-4 py-3 text-right font-bold">Orders</th>
                  <th className="px-4 py-3 text-right font-bold">Spent</th>
                  <th className="px-4 py-3 text-right font-bold">Average order</th>
                  <th className="px-4 py-3 font-bold">Last order</th>
                  <th className="px-4 py-3 font-bold">Offers</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50">
                    <td className="px-4 py-3 font-extrabold text-brand-orange">{r.rank}</td>
                    <td className="px-4 py-3"><p className="font-bold text-brand-brown">{r.p.full_name}</p><p className="text-xs text-stone-400">{r.p.phone ?? "—"}</p></td>
                    <td className="px-4 py-3 text-right font-bold">{r.orders}</td>
                    <td className="px-4 py-3 text-right font-bold text-brand-brown">{npr(r.spent)}</td>
                    <td className="px-4 py-3 text-right text-stone-600">{npr(Math.round(r.spent / r.orders))}</td>
                    <td className="px-4 py-3 text-xs text-stone-500">{when(r.last)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", r.p.marketing_opt_in ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500")}>
                        {r.p.marketing_opt_in ? "Joined" : "Not joined"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-stone-400">Reward your regulars from Offers &amp; Deals, or message everyone who joined offers from Notifications.</p>
        </>
      )}
    </div>
  );
}
