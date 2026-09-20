import { subDays, format, startOfDay } from "date-fns";
import { requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr } from "@/lib/utils";
import { TrendingUp, PackageSearch } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireAuth();
  const since30 = subDays(new Date(), 30).toISOString();

  const [{ data: orders }, { data: items }, { data: movements }, { data: expenses }] = await Promise.all([
    supabaseAdmin.from("orders").select("total, payment_status, status, created_at").gte("created_at", since30),
    supabaseAdmin.from("stock_items").select("id, name, unit, quantity, reorder_level, cost_per_unit").eq("is_active", true),
    supabaseAdmin.from("stock_movements").select("stock_item_id, type, quantity, created_at").gte("created_at", since30),
    supabaseAdmin.from("expenses").select("amount, spent_at").gte("spent_at", since30.slice(0, 10)),
  ]);

  // Daily revenue, last 14 days
  const days = Array.from({ length: 14 }, (_, i) => startOfDay(subDays(new Date(), 13 - i)));
  const daily = days.map((d) => {
    const next = new Date(d.getTime() + 86400000);
    const total = (orders ?? [])
      .filter((o) => {
        const t = new Date(o.created_at);
        return t >= d && t < next && o.payment_status === "paid" && o.status !== "cancelled";
      })
      .reduce((s, o) => s + Number(o.total), 0);
    return { label: format(d, "d MMM"), total };
  });
  const maxDaily = Math.max(1, ...daily.map((d) => d.total));

  const revenue30 = (orders ?? [])
    .filter((o) => o.payment_status === "paid" && o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.total), 0);
  const expenses30 = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  // Stock forecast: avg daily usage over the last 30 days -> days remaining
  const usageByItem = new Map<string, number>();
  (movements ?? []).forEach((m) => {
    if (m.type !== "usage" && m.type !== "wastage") return;
    usageByItem.set(m.stock_item_id, (usageByItem.get(m.stock_item_id) ?? 0) + Math.abs(Number(m.quantity)));
  });
  const forecast = (items ?? []).map((i) => {
    const used30 = usageByItem.get(i.id) ?? 0;
    const perDay = used30 / 30;
    const daysLeft = perDay > 0 ? Number(i.quantity) / perDay : null;
    return { ...i, perDay, daysLeft };
  }).sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-bold text-brand-brown">Reports</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Revenue (30d)</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-green">{npr(revenue30)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Expenses (30d)</p>
          <p className="mt-1 font-display text-2xl font-bold text-brand-red">{npr(expenses30)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Net (30d)</p>
          <p className={`mt-1 font-display text-2xl font-bold ${revenue30 - expenses30 >= 0 ? "text-brand-brown" : "text-brand-red"}`}>{npr(revenue30 - expenses30)}</p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 flex items-center gap-1.5 font-display font-bold text-brand-brown"><TrendingUp size={17} /> Daily revenue — last 14 days</h2>
        <div className="flex h-40 items-end gap-2">
          {daily.map((d) => (
            <div key={d.label} className="group flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md bg-brand-orange/80 transition-colors group-hover:bg-brand-orange"
                style={{ height: `${Math.max(4, (d.total / maxDaily) * 100)}%` }}
                title={npr(d.total)}
              />
              <span className="hidden text-[10px] text-stone-400 sm:block">{d.label.split(" ")[0]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 flex items-center gap-1.5 font-display font-bold text-brand-brown"><PackageSearch size={17} /> Stock forecast</h2>
        <p className="mb-3 text-xs text-stone-500">Estimated days remaining, based on average usage over the last 30 days.</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-orange-100 text-left text-xs uppercase text-stone-400">
              <th className="py-2">Item</th><th className="py-2">On hand</th><th className="py-2">Avg use/day</th><th className="py-2">Est. days left</th>
            </tr>
          </thead>
          <tbody>
            {forecast.map((f) => (
              <tr key={f.id} className="border-b border-orange-50 last:border-0">
                <td className="py-2 font-bold text-brand-brown">{f.name}</td>
                <td className="py-2 text-stone-600">{Number(f.quantity)} {f.unit}</td>
                <td className="py-2 text-stone-500">{f.perDay > 0 ? `${f.perDay.toFixed(2)} ${f.unit}` : "—"}</td>
                <td className={`py-2 font-bold ${f.daysLeft != null && f.daysLeft <= 3 ? "text-brand-red" : f.daysLeft != null && f.daysLeft <= 7 ? "text-amber-600" : "text-stone-600"}`}>
                  {f.daysLeft != null ? `${Math.floor(f.daysLeft)} days` : "No recent usage"}
                </td>
              </tr>
            ))}
            {forecast.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-stone-400">No stock items yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
