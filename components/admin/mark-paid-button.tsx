"use client";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { markOrderPaid, markOrderUnpaid } from "@/app/actions/staff";
import { npr } from "@/lib/utils";

type ActionResult = { ok: boolean; error?: string };

/**
 * Shows the admin exactly how much to collect, then confirms the
 * manual cash/QR payment. Paid orders show a green tick that can be
 * reverted if it was a mis-click.
 */
export default function MarkPaidButton({
  orderId, total, paid, method,
}: { orderId: string; total: number; paid: boolean; method: string | null }) {
  const [pending, start] = useTransition();

  if (paid) {
    return (
      <button
        disabled={pending}
        title="Click to undo (mis-click?)"
        onClick={() => {
          if (!confirm("Undo payment confirmation for this order?")) return;
          start(async () => {
            const r = await markOrderUnpaid(orderId) as ActionResult;
            r?.error ? toast.error(r.error) : toast.success("Reverted to unpaid");
          });
        }}
        className="badge bg-green-100 text-green-800"
      >
        ✓ Paid
      </button>
    );
  }

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(`Collect Rs ${total} (${(method ?? "cash").toUpperCase()}) from the customer, then confirm.`)) return;
        start(async () => {
          const r = await markOrderPaid(orderId) as ActionResult;
          r?.error ? toast.error(r.error) : toast.success(`${npr(total)} marked as received`);
        });
      }}
      className="whitespace-nowrap rounded-full bg-brand-yellow px-3 py-1 text-xs font-bold text-brand-dark hover:brightness-95"
    >
      Collect {npr(total)}
    </button>
  );
}
