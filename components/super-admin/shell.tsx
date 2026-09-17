"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Crown } from "lucide-react";
import SuperAdminSidebar, { NAV } from "./sidebar-nav";

export default function SuperAdminShell({
  fullName, children,
}: {
  fullName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = NAV.find((n) => n.href === "/super-admin" ? pathname === "/super-admin" : pathname.startsWith(n.href));
  const pageTitle = current?.label ?? "Super Admin";

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-white/5 bg-slate-950 transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-5">
          <div>
            <span className="font-display text-lg font-bold text-white">🍜 Thelawalaa</span>
            <p className="mt-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-violet-400">
              <Crown size={11} /> Super Admin
            </p>
          </div>
          <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white lg:hidden">
            <X size={20} />
          </button>
        </div>
        <SuperAdminSidebar onNavigate={() => setOpen(false)} />
      </aside>

      <div className="min-w-0 flex-1 flex flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md px-4 py-3.5 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden">
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold text-slate-900">{pageTitle ?? "Super Admin"}</p>
              <p className="truncate text-xs font-medium text-slate-400">Full system access — {fullName}</p>
            </div>
          </div>
          <span className="hidden shrink-0 sm:inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
            <Crown size={13} /> Super Admin
          </span>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
