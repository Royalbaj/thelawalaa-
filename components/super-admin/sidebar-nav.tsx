"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Users, UserPlus,
  Truck, BarChart3, Megaphone, Settings, LogOut, ExternalLink, Gift, GraduationCap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/super-admin", label: "Dashboard", icon: LayoutDashboard, section: "main" },
  { href: "/super-admin/orders", label: "Orders", icon: ShoppingBag, section: "main" },
  { href: "/super-admin/menu", label: "Menu Items", icon: UtensilsCrossed, section: "main" },
  { href: "/super-admin/offers", label: "Offers & Deals", icon: Gift, section: "marketing" },
  { href: "/super-admin/signups", label: "Signups", icon: UserPlus, section: "marketing" },
  { href: "/super-admin/delivery", label: "Deliveries", icon: Truck, section: "operations" },
  { href: "/super-admin/staff", label: "Staff & Users", icon: Users, section: "operations" },
  { href: "/super-admin/training", label: "Staff Training", icon: GraduationCap, section: "operations" },
  { href: "/super-admin/reports", label: "Reports", icon: BarChart3, section: "operations" },
  { href: "/super-admin/announcements", label: "Announcements", icon: Megaphone, section: "marketing" },
  { href: "/super-admin/settings", label: "Settings", icon: Settings, section: "settings" },
];

const sectionLabels: Record<string, string> = {
  main: "Main",
  marketing: "Marketing",
  operations: "Operations",
  settings: "Configuration",
};

export default function SuperAdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const sections: Record<string, typeof NAV> = {};
  NAV.forEach((item) => {
    if (!sections[item.section]) sections[item.section] = [];
    sections[item.section].push(item);
  });

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      {Object.entries(sections).map(([section, items]) => (
        <div key={section}>
          <p className="px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {sectionLabels[section]}
          </p>
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === "/super-admin" ? pathname === "/super-admin" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200",
                  active
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-900/40"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      ))}

      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-500 hover:bg-white/5 hover:text-white transition-all"
      >
        <ExternalLink size={18} />
        <span>View Website</span>
      </a>

      <button
        onClick={async () => { await createClient().auth.signOut(); router.push("/auth/login"); router.refresh(); }}
        className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-red-400/80 hover:bg-red-500/10 hover:text-red-300 transition-all"
      >
        <LogOut size={18} />
        <span>Sign Out</span>
      </button>
    </nav>
  );
}
