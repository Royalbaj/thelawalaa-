"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LayoutDashboard, ShoppingBag, UtensilsCrossed, BarChart3, MoreHorizontal } from "lucide-react";
import AdminSidebar, { NAV, type NavBadges } from "./sidebar-nav";
import { ACCOUNTS_URL } from "@/lib/role-home";
import { cn } from "@/lib/utils";

// Phones: the four pages used most sit in a bottom bar; "More" opens the full menu.
const TABS = [
  { href: "/admin/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
];

export default function AdminShell({
  fullName, badges = {}, children,
}: {
  fullName: string;
  badges?: NavBadges;
  children: React.ReactNode;
}) {
  const moreBadge = Object.entries(badges).filter(([href]) => !TABS.some((t) => t.href === href)).reduce((s, [, n]) => s + (n ?? 0), 0);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = NAV.find((n) => n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href));
  const pageTitle = current?.label ?? "Admin";
  const inTabs = TABS.some((t) => pathname.startsWith(t.href));

  return (
    <div className="flex min-h-screen bg-stone-100">
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] shrink-0 flex-col border-r border-white/5 bg-brand-dark transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-5">
          <span className="font-display text-lg font-bold brand-gradient-text">Thelawalaa</span>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white lg:hidden">
            <X size={20} />
          </button>
        </div>
        <AdminSidebar onNavigate={() => setOpen(false)} badges={badges} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6 sm:py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 lg:hidden">
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold text-brand-brown">{pageTitle}</p>
              <p className="truncate text-xs font-medium text-stone-400">{fullName}</p>
            </div>
          </div>
        </header>
        <main className="flex-1 p-3 sm:p-6">{children}</main>
        {/* Little footer — above the phone tab bar */}
        <footer className="border-t border-stone-200 px-4 pb-24 pt-4 text-xs text-stone-400 sm:px-6 lg:pb-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span>© {new Date().getFullYear()} Thelawalaa · Admin panel</span>
            <span className="flex flex-wrap gap-x-4 gap-y-1 font-bold">
              <a href="/" target="_blank" rel="noopener noreferrer" className="hover:text-brand-orange">Website</a>
              <a href="/feedback" target="_blank" rel="noopener noreferrer" className="hover:text-brand-orange">Feedback page</a>
              <a href={ACCOUNTS_URL} target="_blank" rel="noopener noreferrer" className="hover:text-brand-orange">Accounts</a>
            </span>
          </div>
        </footer>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur-md lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Main">
        <div className="grid grid-cols-5">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href}
                className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold", active ? "text-brand-orange" : "text-stone-500")}>
                <Icon size={21} /> {label}
              </Link>
            );
          })}
          <button onClick={() => setOpen(true)}
            className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold", !inTabs ? "text-brand-orange" : "text-stone-500")}>
            <span className="relative">
              <MoreHorizontal size={21} />
              {moreBadge > 0 && <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-extrabold text-white">{moreBadge}</span>}
            </span>
            More
          </button>
        </div>
      </nav>
    </div>
  );
}
