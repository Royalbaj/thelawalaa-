"use client";
import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import { ShoppingBag, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import PosTerminal from "@/components/pos/pos-terminal";
import LiveOrdersPanel, { type Order } from "@/components/admin/live-orders-panel";
import type { OpeningPromoSettings } from "@/lib/promo";

type Props = {
  products: Parameters<typeof PosTerminal>[0]["products"];
  categories: { id: string; name: string }[];
  openingPromo: OpeningPromoSettings | null;
  initialOrders: Order[];
  drivers: { id: string; full_name: string; is_online: boolean }[];
};

// Phones, iPads (portrait and the 1024px-wide landscape) and small laptops
// get Sell / Orders tabs; from 1280px both sit side by side. Both panels stay
// mounted when hidden, so Realtime, the chime and the cart all carry on.
export default function PosWorkspace({ products, categories, openingPromo, initialOrders, drivers }: Props) {
  const [tab, setTab] = useState<"sell" | "orders">("sell");
  const [newCount, setNewCount] = useState(0);

  const onNewOrder = useCallback((o: Order) => {
    const no = o.daily_number != null ? `#${String(o.daily_number).padStart(2, "0")}` : "";
    toast((t) => (
      <button className="text-left" onClick={() => { setTab("orders"); toast.dismiss(t.id); }}>
        🔔 <b>New online order {no}</b>
        <span className="ml-2 font-bold text-brand-orange xl:hidden">View</span>
      </button>
    ), { duration: 10_000 });
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 gap-1 px-2 pt-2 xl:hidden">
        {([["sell", "Sell", ShoppingBag], ["orders", "Orders", ListOrdered]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={cn("relative flex flex-1 touch-manipulation items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition",
              tab === key ? "bg-brand-orange text-white shadow-sm" : "bg-white text-stone-600 dark:bg-stone-900 dark:text-stone-300")}>
            <Icon size={16} /> {label}
            {key === "orders" && newCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1.5 text-[11px] font-extrabold text-white">{newCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 gap-3 p-2 xl:gap-4 xl:p-4">
        <div className={cn("min-h-0 flex-1 overflow-hidden rounded-2xl border border-orange-100 dark:border-stone-800", tab !== "sell" && "hidden xl:block")}>
          <PosTerminal products={products} categories={categories} openingPromo={openingPromo} />
        </div>
        <div className={cn("min-h-0 flex-1 overflow-hidden xl:w-[400px] xl:flex-none", tab !== "orders" && "hidden xl:block")}>
          <LiveOrdersPanel initialOrders={initialOrders} drivers={drivers} onNewOrder={onNewOrder} onNewCount={setNewCount} />
        </div>
      </div>
    </div>
  );
}
