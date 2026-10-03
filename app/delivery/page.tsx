import Link from "next/link";
import { Bike, PartyPopper } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDriverJobs, getDriverCounts } from "@/lib/driver-jobs";
import { nepalToday } from "@/lib/dates";
import OnlineToggle from "@/components/delivery/online-toggle";
import JobCard from "@/components/delivery/job-card";
import DriverLive from "@/components/delivery/driver-live";

export const dynamic = "force-dynamic";

export default async function DeliveriesPage() {
  const { user, profile } = await requireRole(["delivery_driver", "super_admin"]);
  const [jobs, counts, { data: me }] = await Promise.all([
    getDriverJobs(user.id),
    getDriverCounts(user.id, `${nepalToday()}T00:00:00+05:45`),
    supabaseAdmin.from("profiles").select("is_online").eq("id", user.id).single(),
  ]);
  const first = profile.full_name.split(" ")[0];

  return (
    <div className="space-y-4">
      <DriverLive jobIds={jobs.map((j) => j.orderId)} />
      <div>
        <h1 className="font-display text-2xl font-extrabold">Hi {first} 👋</h1>
        <p className="text-sm text-white/50">{jobs.length ? `You have ${jobs.length} deliver${jobs.length === 1 ? "y" : "ies"} to make.` : "Your deliveries show up here."}</p>
      </div>

      {profile.role === "delivery_driver" && <OnlineToggle online={!!me?.is_online} />}

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { n: jobs.length, label: "To deliver", tint: "text-orange-300" },
          { n: counts.today, label: "Done today", tint: "text-green-300" },
          { n: counts.total, label: "All time", tint: "text-white" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white/[0.06] py-3 ring-1 ring-white/10">
            <p className={`font-display text-2xl font-extrabold ${s.tint}`}>{s.n}</p>
            <p className="text-[11px] font-bold text-white/45">{s.label}</p>
          </div>
        ))}
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-3xl bg-white/[0.04] px-6 py-12 text-center ring-1 ring-white/10">
          {counts.today > 0 ? <PartyPopper size={34} className="mx-auto mb-3 text-orange-300" /> : <Bike size={34} className="mx-auto mb-3 text-white/30" />}
          <p className="font-bold text-white/80">{counts.today > 0 ? "All caught up!" : "No deliveries right now"}</p>
          <p className="mt-1 text-sm text-white/45">{me?.is_online ? "Stay online — a new one will chime here." : "Go online to start getting deliveries."}</p>
          <Link href="/delivery/history" className="mt-4 inline-block text-sm font-bold text-orange-300">See past deliveries →</Link>
        </div>
      ) : (
        <div className="space-y-4">{jobs.map((j) => <JobCard key={j.orderId} job={j} />)}</div>
      )}
    </div>
  );
}
