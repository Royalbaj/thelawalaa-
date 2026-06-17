"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Users,
  Truck, BarChart3, Megaphone, Settings, LogOut, ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, section: "main" },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag, section: "main" },
  { href: "/admin/menu", label: "Menu Items", icon: UtensilsCrossed, section: "main" },
  { href: "/admin/delivery", label: "Deliveries", icon: Truck, section: "operations" },
  { href: "/admin/staff", label: "Staff & Users", icon: Users, section: "operations" },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, section: "operations" },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone, section: "settings" },
  { href: "/admin/settings", label: "Settings", icon: Settings, section: "settings" },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();

  const sections: Record<string, typeof NAV> = {};
  NAV.forEach((item) => {
    if (!sections[item.section]) sections[item.section] = [];
    sections[item.section].push(item);
  });

  const sectionLabels: Record<string, string> = {
    main: "Main",
    operations: "Operations",
    settings: "Configuration",
  };

  return (
    <nav className="flex h-full flex-col gap-1 p-3 overflow-y-auto">
      {Object.entries(sections).map(([section, items]) => (
        <div key={section}>
          <p className="hidden md:block px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/30">
            {sectionLabels[section]}
          </p>
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200",
                  active 
                    ? "bg-brand-orange text-white shadow-sm shadow-orange-500/30" 
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                )}
              >
                <Icon size={18} />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </div>
      ))}

      {/* View Website Link */}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 hidden md:flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/40 hover:bg-white/10 hover:text-white transition-all"
      >
        <ExternalLink size={18} />
        <span>View Website</span>
      </a>

      {/* Sign Out */}
      <button
        onClick={async () => { await createClient().auth.signOut(); router.push("/auth/login"); router.refresh(); }}
        className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-red-400/70 hover:bg-red-500/10 hover:text-red-300 transition-all"
      >
        <LogOut size={18} />
        <span className="hidden md:inline">Sign Out</span>
      </button>
    </nav>
  );
}
