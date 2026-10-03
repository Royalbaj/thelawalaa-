"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bike, History, Bell, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/delivery", label: "Deliveries", icon: Bike },
  { href: "/delivery/history", label: "History", icon: History },
  { href: "/delivery/updates", label: "Updates", icon: Bell },
  { href: "/delivery/me", label: "Me", icon: UserRound },
];

/** The driver app's only navigation — a floating bar, easy to reach with a thumb (above the iPhone home bar). */
export default function DriverTabs({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Driver"
      className="fixed inset-x-3 z-40 mx-auto max-w-lg rounded-3xl bg-stone-900/95 p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.5)] ring-1 ring-white/10 backdrop-blur-md"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
      <div className="grid grid-cols-4 gap-1">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/delivery" ? pathname === href : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={cn("relative flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition active:scale-95",
                active ? "bg-brand-orange text-white" : "text-white/55 hover:text-white")}>
              <span className="relative">
                <Icon size={22} />
                {href === "/delivery/updates" && unread > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-extrabold text-white">{unread > 9 ? "9+" : unread}</span>
                )}
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
