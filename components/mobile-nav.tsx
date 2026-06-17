"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingCart, BarChart3, Bike } from "lucide-react";

const NAV_ITEMS = [
  { id: "site", label: "Site", href: "/", icon: Home },
  { id: "order", label: "Order", href: "/order", icon: ShoppingCart },
  { id: "admin", label: "Admin", href: "/admin", icon: BarChart3 },
  { id: "driver", label: "Driver", href: "/delivery", icon: Bike },
];

export default function MobileNav() {
  const pathname = usePathname();

  // Highlight logic based on path
  const getActiveId = () => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/pos")) return "admin";
    if (pathname.startsWith("/delivery")) return "driver";
    if (pathname.startsWith("/order") || pathname.startsWith("/track")) return "order";
    return "site"; // default
  };

  const active = getActiveId();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t border-stone-800 bg-[#1A1A1A] px-2 py-2 sm:hidden pb-safe">
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.id;
        const Icon = item.icon;
        
        return (
          <Link
            key={item.id}
            href={item.href}
            className={`flex flex-1 flex-col items-center justify-center rounded-xl py-2 transition-colors ${
              isActive ? "bg-brand-orange text-white" : "text-stone-400 hover:text-stone-200"
            }`}
          >
            <Icon className="mb-1 h-5 w-5" />
            <span className="text-[10px] font-bold uppercase tracking-wide">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
