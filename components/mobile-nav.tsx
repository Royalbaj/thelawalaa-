"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ShoppingCart, Utensils, User, Gift, Package, UserRound } from "lucide-react";
import { useViewerRole } from "@/lib/use-viewer";
import { ROLE_HOME } from "@/lib/role-home";
import { cn } from "@/lib/utils";

const CUSTOMER_NAV = [
  { id: "home", label: "Home", href: "/account", icon: Home },
  { id: "order", label: "Order", href: "/order", icon: ShoppingCart },
  { id: "orders", label: "Orders", href: "/account/orders", icon: Package },
  { id: "rewards", label: "Rewards", href: "/account/rewards", icon: Gift },
  { id: "profile", label: "Profile", href: "/account/profile", icon: User },
];

// The ONLY navigation on phones for the website and the customer portal —
// the top bars there keep just the logo and a button or two, so there are
// never two menus on one screen. Staff screens have their own bars.
export default function MobileNav() {
  const pathname = usePathname();
  const { role, ready } = useViewerRole();

  if (["/admin", "/pos", "/delivery", "/staff", "/auth"].some((p) => pathname.startsWith(p))) return null;

  const items = role === "customer" ? CUSTOMER_NAV : [
    { id: "site", label: "Home", href: "/", icon: Home },
    { id: "menu", label: "Menu", href: "/#menu", icon: Utensils },
    { id: "order", label: "Order", href: "/order", icon: ShoppingCart },
    role
      ? { id: "portal", label: "My portal", href: ROLE_HOME[role] ?? "/", icon: UserRound }
      : { id: "signin", label: "Sign in", href: "/auth/login", icon: UserRound },
  ];

  const active = items.find((item) => {
    if (item.href === "/" || item.href === "/account") return pathname === item.href;
    if (item.href.startsWith("/#")) return false;
    return pathname.startsWith(item.href);
  })?.id;

  return (
    <>
      {/* Room at the end of the page so the floating bar never covers the last
          of the content. Here, not as body padding, so staff screens (no bar)
          don't get a blank strip — on the POS that made the till scroll. */}
      <div aria-hidden className="h-28 md:hidden" />
      <nav
        aria-label="Main"
        className={cn("fixed inset-x-3 z-50 rounded-3xl bg-white/95 p-1.5 shadow-[0_8px_30px_rgba(28,10,0,0.18)] ring-1 ring-stone-200 backdrop-blur-md transition-opacity md:hidden",
          !ready && "opacity-0")}
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="flex gap-1">
          {items.map((item) => {
            const isActive = active === item.id;
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn("flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-bold transition active:scale-95",
                  isActive ? "bg-orange-50 text-brand-orange" : "text-stone-500")}
              >
                <Icon size={22} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
