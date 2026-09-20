"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Store, LayoutDashboard, ShoppingBag, UtensilsCrossed, Gift, UserPlus,
  Megaphone, Truck, Users, GraduationCap, BarChart3, Settings, LogOut, ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/admin", label: "POS Terminal", icon: Store, section: "main" },
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "main" },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag, section: "main" },
  { href: "/admin/menu", label: "Menu Items", icon: UtensilsCrossed, section: "main" },
  { href: "/admin/offers", label: "Offers & Deals", icon: Gift, section: "marketing" },
  { href: "/admin/signups", label: "Signups", icon: UserPlus, section: "marketing" },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone, section: "marketing" },
  { href: "/admin/delivery", label: "Deliveries", icon: Truck, section: "operations" },
  { href: "/admin/staff", label: "Staff & Users", icon: Users, section: "operations" },
  { href: "/admin/training", label: "Staff Training", icon: GraduationCap, section: "operations" },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, section: "operations" },
  { href: "/admin/settings", label: "Settings", icon: Settings, section: "settings" },
];

const sectionLabels: Record<string, string> = {
  main: "Main",
  marketing: "Marketing",
  operations: "Operations",
  settings: "Configuration",
};

export default function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
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
          <p className="px-3 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/30">
            {sectionLabels[section]}
          </p>
          {items.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-200",
                  active
                    ? "bg-brand-orange text-white shadow-sm shadow-orange-900/30"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
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
        className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/40 hover:bg-white/10 hover:text-white transition-all"
      >
        <ExternalLink size={18} />
        <span>View Website</span>
      </a>

      <button
        onClick={async () => { await createClient().auth.signOut(); router.push("/auth/login"); router.refresh(); }}
        className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-red-300/80 hover:bg-red-500/10 hover:text-red-200 transition-all"
      >
        <LogOut size={18} />
        <span>Sign Out</span>
      </button>
    </nav>
  );
}
