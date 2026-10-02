"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { RotateCcw } from "lucide-react";
import { useCart } from "@/lib/store/cart";
import { getReorderItems } from "@/app/actions/customer";

/** Put a past order's items back in the cart (today's prices) and go to checkout. */
export default function ReorderButton({ orderId, className }: { orderId: string; className?: string }) {
  const router = useRouter();
  const { clear, add, setQty } = useCart();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => {
        const r = await getReorderItems(orderId);
        if ("error" in r && r.error) { toast.error(r.error); return; }
        const items = "items" in r ? r.items ?? [] : [];
        if (!items.length) { toast.error("Those items aren't on the menu right now"); return; }
        clear();
        for (const i of items) { add({ product_id: i.product_id, name: i.name, price: i.price }); setQty(i.product_id, i.quantity); }
        if ("skipped" in r && r.skipped) toast(`${r.skipped} item${r.skipped > 1 ? "s aren't" : " isn't"} available today — the rest are in your cart`);
        router.push("/order");
      })}
      className={className ?? "flex items-center gap-1.5 rounded-full border-2 border-brand-orange px-3.5 py-1.5 text-xs font-bold text-brand-orange transition hover:bg-orange-50 disabled:opacity-50"}
    >
      <RotateCcw size={13} /> {pending ? "Adding…" : "Order again"}
    </button>
  );
}
