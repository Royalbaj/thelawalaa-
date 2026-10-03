"use client";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { assignDriver } from "@/app/actions/staff";

/** Pick a rider: online ones first; offline ones can still be given it (they'll see it when they open the app). */
export default function AssignDriver({ orderId, drivers }: { orderId: string; drivers: { id: string; full_name: string; is_online: boolean }[] }) {
  const [pending, start] = useTransition();
  if (drivers.length === 0) return <span className="text-xs text-stone-400">No riders yet — invite one from Staff</span>;
  const sorted = [...drivers].sort((a, b) => Number(b.is_online) - Number(a.is_online));
  return (
    <select
      defaultValue=""
      disabled={pending}
      aria-label="Assign a rider"
      className="input !w-auto !py-1.5 text-base sm:text-xs"
      onChange={(e) => {
        const driverId = e.target.value;
        if (!driverId) return;
        start(async () => {
          const r = await assignDriver(orderId, driverId);
          if (r?.error) toast.error(r.error);
          else toast.success("Rider assigned — they've been notified");
        });
      }}
    >
      <option value="" disabled>{pending ? "Assigning…" : "Assign rider…"}</option>
      {sorted.map((d) => <option key={d.id} value={d.id}>{d.full_name}{d.is_online ? " · online" : " · offline"}</option>)}
    </select>
  );
}
