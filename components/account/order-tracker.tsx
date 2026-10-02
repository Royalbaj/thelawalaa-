import Link from "next/link";
import { Check } from "lucide-react";
import { orderSteps, orderStep } from "@/lib/order-status";
import { cn } from "@/lib/utils";

/** An order in progress: the three steps, with where it is now. */
export default function OrderTracker({ order }: { order: { id: string; order_number: string; daily_number: number | null; status: string; type: string } }) {
  const steps = orderSteps(order.type);
  const at = orderStep(order.status, order.type);
  return (
    <Link href={`/track/${order.id}`} className="block rounded-3xl border border-orange-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-orange">Order in progress</p>
          <p className="mt-0.5 font-display text-lg font-bold text-brand-brown">
            {order.daily_number != null ? `#${String(order.daily_number).padStart(2, "0")} · ` : ""}{order.order_number}
          </p>
        </div>
        <span className="text-sm font-bold text-brand-orange">Track →</span>
      </div>
      <ol className="mt-4 grid grid-cols-3 gap-2">
        {steps.map((label, i) => (
          <li key={label} className="flex flex-col items-center gap-1.5 text-center">
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold",
              i < at ? "bg-brand-green text-white" : i === at ? "bg-brand-orange text-white ring-4 ring-orange-100" : "bg-stone-100 text-stone-400")}>
              {i < at ? <Check size={16} /> : i + 1}
            </span>
            <span className={cn("text-[11px] font-bold leading-tight", i <= at ? "text-brand-brown" : "text-stone-400")}>{label}</span>
          </li>
        ))}
      </ol>
    </Link>
  );
}
