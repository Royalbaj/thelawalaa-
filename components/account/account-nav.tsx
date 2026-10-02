"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/rewards", label: "Rewards" },
  { href: "/account/profile", label: "Profile" },
];

/** Tabs across the top on tablets and laptops (phones use the bottom bar). */
export default function AccountNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 sm:flex" aria-label="Account">
      {TABS.map((t) => {
        const active = t.href === "/account" ? pathname === "/account" : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined}
            className={cn("rounded-full px-4 py-2 text-sm font-bold transition", active ? "bg-orange-50 text-brand-orange" : "text-stone-500 hover:text-brand-brown")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
