import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { npr } from "@/lib/utils";
import { getTrainingStatus } from "@/lib/training-status";
import { servingStats, fmtMinutes, MAX_MIN } from "@/lib/serving-time";
import { nepalToday, addDays } from "@/lib/dates";
import RealtimeFeed from "@/components/admin/realtime-feed";
import { getTodayCloses } from "@/lib/day-sales";
import { getHoursSummary } from "@/lib/time-clock";
import HoursSummary from "@/components/admin/hours/hours-summary";
import Link from "next/link";
import { Package, Wallet, Clock, Bell, Bike, XCircle, ClipboardList, UtensilsCrossed, Megaphone, GraduationCap, MessageSquareHeart, Timer } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireRole(["super_admin"]);
  // Nepal days throughout — the server clock is UTC (5h45m behind Banepa).
  const nepalDay = nepalToday();
  const today = new Date(`${nepalDay}T00:00:00+05:45`).toISOString();
  const [{ data: timed }, { data: todays }, { count: activeDeliveries }, { count: pendingCount }, training, hours] = await Promise.all([
    supabaseAdmin.from("orders").select("created_at, ready_at, served_at, status, placed_by")
      .gte("created_at", `${addDays(nepalDay, -6)}T00:00:00+05:45`),
    supabaseAdmin.from("orders").select("total, payment_status, status").gte("created_at", today),
    supabaseAdmin.from("orders").select("id", { count: "exact", head: true })
      .eq("type", "delivery").in("status", ["assigned", "picked_up", "on_the_way"]),
    supabaseAdmin.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    getTrainingStatus(),
    getHoursSummary(),
  ]);
  const closes = await getTodayCloses();
  const { data: feedbackRows } = await supabaseAdmin.from("feedback").select("rating, is_read");
  const feedbackCount = feedbackRows?.length ?? 0;
  const feedbackAvg = feedbackCount ? feedbackRows!.reduce((s, f) => s + f.rating, 0) / feedbackCount : 0;
  const feedbackNew = (feedbackRows ?? []).filter((f) => !f.is_read).length;
  const stillTraining = training.trainees.filter((t) => t.missing.length > 0);
  const week = timed ?? [];
  const todayStart = new Date(`${nepalDay}T00:00:00+05:45`).getTime();
  const serveToday = servingStats(week.filter((o) => new Date(o.created_at).getTime() >= todayStart));
  const serveWeek = servingStats(week);
  const serveCounter = servingStats(week.filter((o) => o.placed_by));
  const serveOnline = servingStats(week.filter((o) => !o.placed_by));

  const revenue = (todays ?? [])
    .filter((o) => o.payment_status === "paid" && o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.total), 0);

  const toCollect = (todays ?? [])
    .filter((o) => o.payment_status === "pending" && o.status !== "cancelled")
    .reduce((s, o) => s + Number(o.total), 0);

  const cancelledToday = (todays ?? []).filter((o) => o.status === "cancelled").length;

  const { data: recent } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, daily_number, status, type, total, payment_status, payment_method, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  const stats: { label: string; value: string; icon: typeof Package; iconBg: string; highlight?: boolean }[] = [
    { label: "Today's Orders", value: String(todays?.length ?? 0), icon: Package, iconBg: "bg-blue-100 text-blue-600" },
    { label: "Revenue (Confirmed)", value: npr(revenue), icon: Wallet, iconBg: "bg-green-100 text-brand-green" },
    { label: "To Collect (Unpaid)", value: npr(toCollect), icon: Clock, iconBg: "bg-amber-100 text-amber-600", highlight: toCollect > 0 },
    { label: "Pending Orders", value: String(pendingCount ?? 0), icon: Bell, iconBg: "bg-red-100 text-brand-red", highlight: (pendingCount ?? 0) > 0 },
    { label: "Active Deliveries", value: String(activeDeliveries ?? 0), icon: Bike, iconBg: "bg-purple-100 text-purple-600" },
    { label: "Cancelled Today", value: String(cancelledToday), icon: XCircle, iconBg: "bg-stone-200 text-stone-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-2xl bg-white p-5 shadow-sm border transition hover:shadow-md ${s.highlight ? "border-amber-300 ring-2 ring-amber-200/60" : "border-orange-100"}`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.iconBg}`}>
              <s.icon size={19} strokeWidth={2.3} />
            </div>
            <p className="mt-3 text-xs font-bold uppercase tracking-wide text-stone-400">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-brand-brown">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Cash drawer — each "Close shift" from the POS (Today button) */}
      <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-brand-brown"><Wallet size={19} className="text-brand-orange" /> Cash drawer today</h2>
          <p className="text-xs text-stone-400">Counted at the POS with &ldquo;Today → Close shift&rdquo;.</p>
        </div>
        {closes.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">No shift closed yet today.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {closes.map((c) => (
              <li key={c.at} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="text-stone-600">
                  {new Date(c.at).toLocaleTimeString("en-GB", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit", hour12: true })}
                  {c.counted_by ? ` · ${c.counted_by}` : ""} · expected {npr(c.expected_cash)}, counted {npr(c.counted_cash)}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${Math.abs(c.difference) < 1 ? "bg-green-100 text-green-800" : c.difference < 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                  {Math.abs(c.difference) < 1 ? "Balanced" : c.difference < 0 ? `Short ${npr(-c.difference)}` : `Over ${npr(c.difference)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Serving time — order placed → handed over (stamped when staff tap Ready / Served) */}
      <section className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-brand-brown"><Timer size={19} className="text-brand-orange" /> Average serving time</h2>
          <p className="text-xs text-stone-400">Order placed → served / collected. Orders left open over {MAX_MIN / 60} h aren&apos;t counted.</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Today", value: fmtMinutes(serveToday.avgServe), sub: serveToday.served ? `${serveToday.served} served · ready in ${fmtMinutes(serveToday.avgReady)}` : "No orders served yet today", big: true },
            { label: "Last 7 days", value: fmtMinutes(serveWeek.avgServe), sub: serveWeek.served ? `${serveWeek.served} served · ready in ${fmtMinutes(serveWeek.avgReady)}` : "—" },
            { label: "Counter (7 days)", value: fmtMinutes(serveCounter.avgServe), sub: `${serveCounter.served} orders` },
            { label: "Online (7 days)", value: fmtMinutes(serveOnline.avgServe), sub: `${serveOnline.served} orders` },
          ].map((t) => (
            <div key={t.label} className={`rounded-xl p-3.5 ${t.big ? "bg-orange-50" : "bg-stone-50"}`}>
              <p className="text-xs font-bold uppercase tracking-wide text-stone-400">{t.label}</p>
              <p className="mt-1 font-display text-2xl font-bold text-brand-brown">{t.value}</p>
              <p className="mt-0.5 text-xs text-stone-500">{t.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Staff hours from the POS time clock — totals only; shifts and fixes are in Staff Hours */}
      <HoursSummary s={hours} link />

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/admin/orders" className="inline-flex items-center gap-2 rounded-xl bg-brand-orange text-white px-4 py-2.5 text-sm font-bold shadow-warm hover:brightness-110 transition">
          <ClipboardList size={16} /> View All Orders
        </Link>
        <Link href="/admin/menu" className="inline-flex items-center gap-2 rounded-xl bg-white text-brand-brown px-4 py-2.5 text-sm font-bold shadow-sm border border-orange-100 hover:bg-orange-50 transition">
          <UtensilsCrossed size={16} /> Manage Menu
        </Link>
        <Link href="/admin/announcements" className="inline-flex items-center gap-2 rounded-xl bg-white text-brand-brown px-4 py-2.5 text-sm font-bold shadow-sm border border-orange-100 hover:bg-orange-50 transition">
          <Megaphone size={16} /> Announcements
        </Link>
      </div>

      {/* Customer feedback from /feedback */}
      <Link
        href={feedbackNew ? "/admin/feedback?show=new" : "/admin/feedback"}
        className={`flex items-center gap-3 rounded-2xl border p-4 transition hover:shadow-md ${feedbackNew ? "border-orange-300 bg-orange-50" : "border-orange-100 bg-white"}`}
      >
        <MessageSquareHeart size={20} className="shrink-0 text-brand-orange" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-brand-brown">
            Customer feedback: {feedbackCount ? `${feedbackAvg.toFixed(1)} / 5 from ${feedbackCount}` : "none yet"}
          </p>
          <p className="truncate text-xs text-stone-500">
            {feedbackNew ? `${feedbackNew} new to read` : feedbackCount ? "All read" : "Share thelawalaa.com/feedback with customers"}
          </p>
        </div>
        <span className="shrink-0 text-sm font-bold text-brand-orange">{feedbackNew ? "Read →" : "Open →"}</span>
      </Link>

      {/* Staff training — who still has to finish the videos on the Staff Portal */}
      {training.trainees.length > 0 && (
        <Link
          href="/admin/training"
          className={`flex items-center gap-3 rounded-2xl border p-4 transition hover:shadow-md ${stillTraining.length ? "border-amber-300 bg-amber-50" : "border-green-200 bg-green-50"}`}
        >
          <GraduationCap size={20} className={stillTraining.length ? "shrink-0 text-amber-600" : "shrink-0 text-brand-green"} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-brand-brown">
              Staff training: {training.trainees.length - stillTraining.length} of {training.trainees.length} finished
            </p>
            <p className="truncate text-xs text-stone-500">
              {stillTraining.length ? `Not finished yet: ${stillTraining.map((t) => t.name).join(", ")}` : "Everyone has watched every training video."}
            </p>
          </div>
          <span className="shrink-0 text-sm font-bold text-brand-orange">See who →</span>
        </Link>
      )}

      {/* Live Orders */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-brand-brown flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand-green animate-pulse" />
            Live Orders
          </h2>
          <Link href="/admin/orders" className="text-sm font-bold text-brand-orange hover:underline">
            See all →
          </Link>
        </div>
        <RealtimeFeed initial={(recent ?? []) as never} />
      </div>
    </div>
  );
}
