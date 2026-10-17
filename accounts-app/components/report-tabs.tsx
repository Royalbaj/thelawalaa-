"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** Reports ⇄ Running cost, keeping the dates picked. */
export function ReportTabs({ current }: { current: "reports" | "running" }) {
  const q = useSearchParams().toString();
  const tabs = [["reports", "/reports", "Money in & out"], ["running", "/running", "Running cost"]] as const;
  return (
    <nav aria-label="Reports" className="flex gap-0.5 rounded-full bg-stone-100 p-1 print:hidden">
      {tabs.map(([key, href, label]) => (
        <Link key={key} href={q ? `${href}?${q}` : href} aria-current={current === key ? "page" : undefined}
          className={cn("rounded-full px-3.5 py-1.5 text-sm font-bold transition",
            current === key ? "bg-white text-brand-brown shadow-sm" : "text-stone-500 hover:text-stone-800")}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
