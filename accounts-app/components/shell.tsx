"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Package, Receipt, BarChart3, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export default function Shell({ fullName, children }: { fullName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-30 border-b border-orange-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="font-display text-lg font-bold brand-gradient-text">Thelawalaa Accounts</span>
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold transition",
                      active ? "bg-brand-orange text-white" : "text-stone-500 hover:bg-orange-50 hover:text-brand-brown"
                    )}
                  >
                    <Icon size={15} /> {label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-bold text-stone-400 sm:inline">{fullName}</span>
            <button
              onClick={async () => { await createClient().auth.signOut(); router.push("/login"); router.refresh(); }}
              aria-label="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-full text-stone-400 transition hover:bg-red-50 hover:text-brand-red"
            >
              <LogOut size={16} />
            </button>
            <button onClick={() => setOpen(!open)} className="flex h-9 w-9 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 sm:hidden">
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="flex flex-col gap-1 border-t border-orange-100 p-3 sm:hidden">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition",
                    active ? "bg-brand-orange text-white" : "text-stone-600 hover:bg-orange-50"
                  )}
                >
                  <Icon size={16} /> {label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-5xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
