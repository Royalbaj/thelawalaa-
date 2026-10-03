import { CheckCircle2, Clock, Package } from "lucide-react";
import { requireRole } from "@/lib/supabase/server";
import { getDriverHistory } from "@/lib/driver-jobs";

export const dynamic = "force-dynamic";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Kathmandu", weekday: "short", day: "numeric", month: "short" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit", hour12: true });

// Past deliveries: what and when — deliberately no amounts.
export default async function HistoryPage() {
  const { user } = await requireRole(["delivery_driver", "super_admin"]);
  const done = await getDriverHistory(user.id);
  const groups = new Map<string, typeof done>();
  for (const d of done) {
    const key = d.deliveredAt ? day(d.deliveredAt) : "Earlier";
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">History</h1>
        <p className="text-sm text-white/50">Your last {done.length} deliveries.</p>
      </div>
      {done.length === 0 && (
        <div className="rounded-3xl bg-white/[0.04] px-6 py-12 text-center ring-1 ring-white/10">
          <Package size={32} className="mx-auto mb-3 text-white/30" />
          <p className="font-bold text-white/80">Nothing delivered yet</p>
        </div>
      )}
      {[...groups].map(([label, rows]) => (
        <section key={label}>
          <p className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-white/40">
            <span>{label}</span><span>{rows.length} deliver{rows.length === 1 ? "y" : "ies"}</span>
          </p>
          <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl bg-white/[0.05] ring-1 ring-white/10">
            {rows.map((d) => (
              <li key={d.orderNumber} className="flex items-center gap-3 px-4 py-3">
                <CheckCircle2 size={18} className="shrink-0 text-green-400" />
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-bold text-white">{d.orderNumber}</p>
                  <p className="truncate text-xs text-white/45">{d.itemCount} item{d.itemCount === 1 ? "" : "s"}{d.area ? ` · ${d.area}` : ""}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-white/50">
                  {d.deliveredAt && <p className="font-bold text-white/70">{time(d.deliveredAt)}</p>}
                  {d.minutes != null && <p className="flex items-center justify-end gap-1"><Clock size={11} /> {d.minutes} min</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
