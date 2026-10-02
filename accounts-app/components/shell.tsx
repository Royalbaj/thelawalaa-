"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, ListOrdered, BarChart3, Settings, Package, Lock, LogOut, Plus, ArrowDownLeft, ArrowUpRight, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { lockAccounts } from "@/app/actions/pin";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/entries", label: "Entries", icon: ListOrdered },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/stock", label: "Stock", icon: Package },
  { href: "/settings", label: "Settings", icon: Settings },
];
const IDLE_LOCK_MS = 15 * 60_000;

async function lockNow() {
  await lockAccounts();
  window.location.replace(`/pin?next=${encodeURIComponent(location.pathname + location.search)}`);
}

export default function Shell({ fullName, children }: { fullName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [adding, setAdding] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  // The entry form brings its own pinned Save bar on phones — no tabs underneath it.
  const onForm = pathname === "/entries/new" || /^\/entries\/[0-9a-f-]{36}$/.test(pathname);

  useEffect(() => {
    // Lock by itself after 15 minutes without a tap or key — it's money, on shared devices.
    let last = Date.now();
    const touch = () => { last = Date.now(); };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = setInterval(() => { if (Date.now() - last > IDLE_LOCK_MS) lockNow(); }, 30_000);
    // Back/forward cache would otherwise show these screens after locking or signing out.
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) location.reload(); };
    window.addEventListener("pageshow", onShow);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(timer);
      window.removeEventListener("pageshow", onShow);
    };
  }, []);

  async function signOut() {
    await lockAccounts();
    await createClient().auth.signOut({ scope: "local" });
    window.location.replace("/login");
  }

  return (
    <div className="min-h-dvh bg-stone-50">
      <header className="sticky top-0 z-30 border-b print:hidden border-orange-100 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-center gap-5">
            <Link href="/" className="font-display text-lg font-bold brand-gradient-text">Thelawalaa Accounts</Link>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href}
                  className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold transition",
                    isActive(href) ? "bg-brand-orange text-white" : "text-stone-500 hover:bg-orange-50 hover:text-brand-brown")}>
                  <Icon size={15} /> {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-2 hidden text-sm font-bold text-stone-400 lg:inline">{fullName}</span>
            <button onClick={lockNow} aria-label="Lock" title="Lock (PIN needed to open again)"
              className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-stone-500 transition hover:bg-stone-100">
              <Lock size={16} /> <span className="hidden sm:inline">Lock</span>
            </button>
            <button onClick={signOut} aria-label="Sign out" title="Sign out"
              className="flex h-10 w-10 items-center justify-center rounded-full text-stone-400 transition hover:bg-red-50 hover:text-brand-red">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 pb-28 sm:p-6 md:pb-10">{children}</main>

      {/* Phones and tablets: bottom tabs with a big "+" in the middle. */}
      {!onForm && <>
      {adding && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setAdding(false)} />}
      {adding && (
        <div className="fixed inset-x-4 bottom-24 z-50 grid grid-cols-2 gap-3 md:hidden" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
          <Link href="/entries/new?kind=in" onClick={() => setAdding(false)}
            className="flex flex-col items-center gap-1 rounded-2xl bg-white p-4 font-bold text-brand-brown shadow-xl">
            <ArrowDownLeft size={22} className="text-[#2a78d6]" /> Money in
          </Link>
          <Link href="/entries/new?kind=out" onClick={() => setAdding(false)}
            className="flex flex-col items-center gap-1 rounded-2xl bg-white p-4 font-bold text-brand-brown shadow-xl">
            <ArrowUpRight size={22} className="text-[#eb6834]" /> Money out
          </Link>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-white md:hidden print:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid grid-cols-5">
          {[NAV[0], NAV[1]].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold", isActive(href) ? "text-brand-orange" : "text-stone-500")}>
              <Icon size={20} /> {label}
            </Link>
          ))}
          <button onClick={() => setAdding((v) => !v)} aria-label="Add an entry" className="flex items-center justify-center">
            <span className={cn("-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand-orange text-white shadow-lg shadow-orange-500/40 transition", adding && "rotate-45")}>
              {adding ? <X size={26} className="-rotate-45" /> : <Plus size={28} />}
            </span>
          </button>
          {[NAV[2], NAV[4]].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold", isActive(href) ? "text-brand-orange" : "text-stone-500")}>
              <Icon size={20} /> {label}
            </Link>
          ))}
        </div>
      </nav>
      </>}
    </div>
  );
}
