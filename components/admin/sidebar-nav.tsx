"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Users,
  Truck, BarChart3, Megaphone, Settings, LogOut,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/staff", label: "Staff & Users", icon: Users },
  { href: "/admin/delivery", label: "Delivery", icon: Truck },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors",
              active ? "bg-brand-orange text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon size={18} />
            <span className="hidden md:inline">{label}</span>
          </Link>
        );
      })}
      <button
        onClick={async () => { await createClient().auth.signOut(); router.push("/auth/login"); router.refresh(); }}
        className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white"
      >
        <LogOut size={18} />
        <span className="hidden md:inline">Sign out</span>
      </button>
    </nav>
  );
}
