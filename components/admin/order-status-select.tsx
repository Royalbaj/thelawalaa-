"use client";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { adminUpdateOrderStatus } from "@/app/actions/staff";
import { STATUS_COLORS, cn } from "@/lib/utils";

const STATUSES = ["pending","confirmed","preparing","ready","assigned","picked_up","on_the_way","delivered","cancelled"];

export default function OrderStatusSelect({ orderId, status }: { orderId: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={status}
      disabled={pending}
      className={cn("rounded-full border-0 px-3 py-1 text-xs font-bold", STATUS_COLORS[status])}
      onChange={(e) =>
        start(async () => {
          const r = await adminUpdateOrderStatus(orderId, e.target.value);
          r?.error ? toast.error(r.error) : toast.success("Status updated");
        })
      }
    >
      {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
    </select>
  );
}
