import { subDays, startOfDay, format } from "date-fns";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireRole(["super_admin"]);
  const since = startOfDay(subDays(new Date(), 29)).toISOString();

  const [{ data: orders }, { data: items }] = await Promise.all([
    supabaseAdmin.from("orders")
      .select("total, status, payment_status, payment_method, created_at")
      .gte("created_at", since),
    supabaseAdmin.from("order_items")
      .select("product_name, quantity, line_total, orders!inner(created_at, status)")
      .gte("orders.created_at", since).neq("orders.status", "cancelled"),
  ]);

  const paid = (orders ?? []).filter((o) => o.payment_status === "paid" && o.status !== "cancelled");
  const totalRevenue = paid.reduce((s, o) => s + Number(o.total), 0);
  const avg = paid.length ? totalRevenue / paid.length : 0;

  // Daily revenue, last 14 days
  const days = Array.from({ length: 14 }, (_, i) => startOfDay(subDays(new Date(), 13 - i)));
  const daily = days.map((d) => {
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const sum = paid
      .filter((o) => { const t = new Date(o.created_at); return t >= d && t < next; })
      .reduce((s, o) => s + Number(o.total), 0);
    return { label: format(d, "d MMM"), sum };
  });
  const max = Math.max(...daily.map((d) => d.sum), 1);

  // Top products
  const byProduct = new Map<string, { qty: number; revenue: number }>();
  for (const i of items ?? []) {
    const cur = byProduct.get(i.product_name) ?? { qty: 0, revenue: 0 };
    cur.qty += i.quantity; cur.revenue += Number(i.line_total);
    byProduct.set(i.product_name, cur);
  }
  const top = [...byProduct.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 10);

  // Payment method split
  const byMethod = new Map<string, number>();
  for (const o of paid) byMethod.set(o.payment_method ?? "other", (byMethod.get(o.payment_method ?? "other") ?? 0) + Number(o.total));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Revenue (30d)", value: npr(totalRevenue) },
          { label: "Paid orders (30d)", value: String(paid.length) },
          { label: "Avg order value", value: npr(Math.round(avg)) },
          { label: "Top product", value: top[0]?.[0] ?? "—" },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-500">{s.label}</p>
            <p className="mt-1 truncate font-display text-xl font-bold text-brand-brown">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="card p-5">
        <h2 className="mb-4 font-display font-bold text-brand-brown">Daily revenue — last 14 days</h2>
        <div className="flex h-40 items-end gap-1.5">
          {daily.map((d) => (
            <div key={d.label} className="group flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t-md bg-brand-orange/80 transition-colors group-hover:bg-brand-orange"
                   style={{ height: `${Math.max((d.sum / max) * 100, 2)}%` }}
                   title={`${d.label}: ${npr(d.sum)}`} />
              <span className="hidden text-[10px] text-stone-400 sm:block">{d.label.split(" ")[0]}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 font-display font-bold text-brand-brown">Top products (30d)</h2>
          <table className="w-full text-sm">
            <tbody>
              {top.map(([name, v], i) => (
                <tr key={name} className="border-b border-orange-50 last:border-0">
                  <td className="py-2 text-stone-400">{i + 1}</td>
                  <td className="py-2 font-bold">{name}</td>
                  <td className="py-2 text-right">{v.qty}×</td>
                  <td className="py-2 text-right font-bold">{npr(v.revenue)}</td>
                </tr>
              ))}
              {top.length === 0 && <tr><td className="py-6 text-center text-stone-500">No sales yet.</td></tr>}
            </tbody>
          </table>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-display font-bold text-brand-brown">Revenue by payment method</h2>
          {[...byMethod.entries()].map(([m, v]) => (
            <div key={m} className="mb-3">
              <div className="mb-1 flex justify-between text-sm"><span className="font-bold uppercase">{m}</span><span>{npr(v)}</span></div>
              <div className="h-2 rounded-full bg-orange-50">
                <div className="h-2 rounded-full bg-brand-green" style={{ width: `${(v / Math.max(totalRevenue, 1)) * 100}%` }} />
              </div>
            </div>
          ))}
          {byMethod.size === 0 && <p className="py-6 text-center text-sm text-stone-500">No paid orders yet.</p>}
        </section>
      </div>
    </div>
  );
}
