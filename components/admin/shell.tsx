"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import AdminSidebar, { NAV } from "./sidebar-nav";

export default function AdminShell({
  fullName, children,
}: {
  fullName: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = NAV.find((n) => n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href));
  const pageTitle = current?.label ?? "Admin";

  return (
    <div className="flex min-h-screen bg-stone-100">
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 shrink-0 flex-col border-r border-white/5 bg-brand-dark transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-5">
          <span className="font-display text-lg font-bold brand-gradient-text">Thelawalaa</span>
          <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white lg:hidden">
            <X size={20} />
          </button>
        </div>
        <AdminSidebar onNavigate={() => setOpen(false)} />
      </aside>

      <div className="min-w-0 flex-1 flex flex-col">
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur-md px-4 py-3.5 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 lg:hidden">
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-bold text-brand-brown">{pageTitle}</p>
              <p className="truncate text-xs font-medium text-stone-400">{fullName}</p>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
