import Link from "next/link";
import { cn } from "@/lib/utils";

/** Stock ⇄ Waste & loss — both about what the shop has (and lost). */
export function StockTabs({ current }: { current: "stock" | "waste" }) {
  const tabs = [["stock", "/stock", "Stock levels"], ["waste", "/stock/waste", "Waste & loss"]] as const;
  return (
    <nav aria-label="Stock" className="flex w-fit gap-0.5 rounded-full bg-stone-100 p-1 print:hidden">
      {tabs.map(([key, href, label]) => (
        <Link key={key} href={href} aria-current={current === key ? "page" : undefined}
          className={cn("rounded-full px-3.5 py-1.5 text-sm font-bold transition",
            current === key ? "bg-white text-brand-brown shadow-sm" : "text-stone-500 hover:text-stone-800")}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
