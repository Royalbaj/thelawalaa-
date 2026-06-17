"use client";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { assignDriver } from "@/app/actions/staff";

export default function AssignDriver({ orderId, drivers }: { orderId: string; drivers: { id: string; full_name: string }[] }) {
  const [pending, start] = useTransition();
  if (drivers.length === 0) return <span className="text-xs text-stone-400">No drivers online</span>;
  return (
    <select
      defaultValue=""
      disabled={pending}
      className="input !w-auto !py-1 text-xs"
      onChange={(e) => {
        const driverId = e.target.value;
        if (!driverId) return;
        start(async () => {
          const r = await assignDriver(orderId, driverId);
          r?.error ? toast.error(r.error) : toast.success("Driver assigned");
        });
      }}
    >
      <option value="" disabled>Assign driver…</option>
      {drivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
    </select>
  );
}
