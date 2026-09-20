import { startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { requireAuth } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr } from "@/lib/utils";
import Link from "next/link";
import { Wallet, TrendingDown, AlertTriangle, Package, Receipt } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { profile } = await requireAuth();
  const now = new Date();
  const dayStart = startOfDay(now).toISOString();
  const weekStart = startOfWeek(now).toISOString();
  const monthStart = startOfMonth(now).toISOString();

  const [{ data: monthOrders }, { data: monthExpenses }, { data: lowStock }] = await Promise.all([
    supabaseAdmin.from("orders").select("total, payment_status, status, created_at").gte("created_at", monthStart),
    supabaseAdmin.from("expenses").select("amount, spent_at").gte("spent_at", monthStart.slice(0, 10)),
    supabaseAdmin.from("stock_items").select("id, name, quantity, reorder_level, unit").eq("is_active", true),
  ]);

  const revenueOf = (since: string) =>
    (monthOrders ?? [])
      .filter((o) => o.created_at >= since && o.payment_status === "paid" && o.status !== "cancelled")
      .reduce((s, o) => s + Number(o.total), 0);

  const todayRevenue = revenueOf(dayStart);
  const weekRevenue = revenueOf(weekStart);
  const monthRevenue = revenueOf(monthStart);
  const monthExpenseTotal = (monthExpenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const netThisMonth = monthRevenue - monthExpenseTotal;
  const lowStockItems = (lowStock ?? []).filter((i) => Number(i.quantity) <= Number(i.reorder_level));

  const stats = [
    { label: "Today's Revenue", value: npr(todayRevenue), icon: Wallet, iconBg: "bg-green-100 text-brand-green" },
    { label: "This Week", value: npr(weekRevenue), icon: Wallet, iconBg: "bg-blue-100 text-blue-600" },
    { label: "This Month", value: npr(monthRevenue), icon: Wallet, iconBg: "bg-orange-100 text-brand-orange" },
    { label: "Expenses (Month)", value: npr(monthExpenseTotal), icon: TrendingDown, iconBg: "bg-red-100 text-brand-red" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-brown">Welcome, {profile.full_name.split(" ")[0]}</h1>
        <p className="text-sm text-stone-500">Here&apos;s how the business is doing.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.iconBg}`}>
              <s.icon size={19} strokeWidth={2.3} />
            </div>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-stone-400">{s.label}</p>
            <p className="mt-1 font-display text-xl font-bold text-brand-brown">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Net this month</p>
        <p className={`mt-1 font-display text-3xl font-bold ${netThisMonth >= 0 ? "text-brand-green" : "text-brand-red"}`}>
          {netThisMonth >= 0 ? "+" : ""}{npr(netThisMonth)}
        </p>
        <p className="mt-1 text-xs text-stone-400">Revenue minus logged expenses, month to date</p>
      </div>

      {lowStockItems.length > 0 && (
        <div className="card border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-600" />
            <p className="font-display font-bold text-amber-800">Low stock</p>
          </div>
          <ul className="mt-2 space-y-1">
            {lowStockItems.map((i) => (
              <li key={i.id} className="text-sm text-amber-800">
                <span className="font-bold">{i.name}</span> — {Number(i.quantity)} {i.unit} left (reorder at {Number(i.reorder_level)})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link href="/stock" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-brown shadow-sm border border-orange-100 hover:bg-orange-50 transition">
          <Package size={16} /> Manage Stock
        </Link>
        <Link href="/expenses" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-brown shadow-sm border border-orange-100 hover:bg-orange-50 transition">
          <Receipt size={16} /> Log Expense
        </Link>
      </div>
    </div>
  );
}
