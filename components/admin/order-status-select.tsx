"use client";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { adminUpdateOrderStatus } from "@/app/actions/staff";
import { STATUS_COLORS, cn } from "@/lib/utils";
import { orderStatusLabel } from "@/lib/order-status";

// The three customer-facing steps plus done/cancelled; delivery orders also keep
// the driver hand-off states. An old status (e.g. 'preparing') stays listed as itself.
const PICKUP = ["pending", "confirmed", "ready", "delivered", "cancelled"];
const DELIVERY = ["pending", "confirmed", "ready", "assigned", "picked_up", "on_the_way", "delivered", "cancelled"];
const STAFF_LABELS: Record<string, string> = {
  preparing: "Confirmed (preparing)",
  assigned: "Driver assigned",
  picked_up: "Picked up",
};

function optionLabel(status: string, type: string) {
  if (status === "ready") return type === "delivery" ? "Ready for driver" : "Ready to collect";
  return STAFF_LABELS[status] ?? orderStatusLabel(status, type);
}

export default function OrderStatusSelect({ orderId, status, type }: { orderId: string; status: string; type: string }) {
  const [pending, start] = useTransition();
  const base = type === "delivery" ? DELIVERY : PICKUP;
  const options = base.includes(status) ? base : [status, ...base];
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
      {options.map((s) => <option key={s} value={s}>{optionLabel(s, type)}</option>)}
    </select>
  );
}
