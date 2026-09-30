"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingCart, Utensils, User, Gift, Package } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const PUBLIC_NAV = [
  { id: "site", label: "Home", href: "/", icon: Home },
  { id: "menu", label: "Menu", href: "/#menu", icon: Utensils },
  { id: "order", label: "Order & Collect", href: "/order", icon: ShoppingCart },
];

const CUSTOMER_NAV = [
  { id: "home", label: "Home", href: "/account", icon: Home },
  { id: "order", label: "Order", href: "/order", icon: ShoppingCart },
  { id: "orders", label: "My Orders", href: "/account/orders", icon: Package },
  { id: "rewards", label: "Rewards", href: "/account/rewards", icon: Gift },
  { id: "profile", label: "Profile", href: "/account/profile", icon: User },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function checkRole() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setRole(null); return; }
      
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (data) setRole(data.role);
    }
    checkRole();
  }, []);

  // Hide mobile nav entirely in staff-facing portals
  if (pathname.startsWith("/admin") || pathname.startsWith("/pos") || pathname.startsWith("/delivery") || pathname.startsWith("/staff")) {
    return null;
  }

  const isCustomer = role === "customer" || role === "super_admin";
  const navItems = isCustomer ? CUSTOMER_NAV : PUBLIC_NAV;
  
  const active = navItems.find((item) => {
    if (item.href === "/" && pathname !== "/") return false;
    if (item.href === "/account" && pathname !== "/account") return false;
    return pathname.startsWith(item.href);
  })?.id || navItems[0].id;

  if (isCustomer) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-stone-200 shadow-lg sm:hidden pb-safe">
        <div className="flex">
          {navItems.map((item) => {
            const isActive = active === item.id;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex flex-1 flex-col items-center justify-center py-2.5 transition-colors ${
                  isActive ? "text-brand-orange" : "text-stone-500 hover:text-brand-orange"
                }`}
              >
                <Icon className={`mb-1 ${isActive ? "fill-brand-orange/20" : ""}`} size={20} />
                <span className="text-[10px] font-bold">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  // Public Nav
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t border-stone-800 bg-[#1A1A1A] px-2 py-2 sm:hidden pb-safe">
      {navItems.map((item) => {
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
