"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ShoppingBag, Truck, LogOut, ExternalLink, GraduationCap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "POS Terminal", icon: LayoutDashboard },
  { href: "/admin/orders", label: "All Orders", icon: ShoppingBag },
  { href: "/admin/delivery", label: "Deliveries", icon: Truck },
  { href: "/staff", label: "Training", icon: GraduationCap },
];

export default function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="flex h-full flex-col gap-1 p-3 overflow-y-auto">
      <p className="hidden md:block px-3 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/30">
        Operations
      </p>
      {NAV.map(({ href, label, icon: Icon }) => {
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

      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 hidden md:flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/40 hover:bg-white/10 hover:text-white transition-all"
      >
        <ExternalLink size={18} />
        <span>View Website</span>
      </a>

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
