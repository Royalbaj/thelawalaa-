"use client";
import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** The training screens' footer — and a warning if the connection drops (a finished video can't be saved offline). */
export default function StaffFooter() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return (
    <footer className="border-t border-stone-200 px-4 py-3 text-[11px] font-bold text-stone-400 dark:border-stone-800 dark:text-stone-500"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span>© {new Date().getFullYear()} Thelawalaa · Staff training</span>
        <span className="hidden sm:inline">Godam Chowk, Banepa</span>
        <span className={cn("flex items-center gap-1", online ? "text-green-600 dark:text-green-500" : "text-brand-red")} role="status">
          {online ? <Wifi size={12} /> : <WifiOff size={12} />}
          {online ? "Online" : "Offline — progress won't save"}
        </span>
      </div>
    </footer>
  );
}
