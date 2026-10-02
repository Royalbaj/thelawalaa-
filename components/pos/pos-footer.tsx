"use client";
import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** One slim line under the POS. The useful part: it says when the iPad has lost
 *  the internet, before an order fails to save. */
export default function PosFooter() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  return (
    <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-stone-200 bg-white/70 px-3 py-1 text-[11px] font-bold text-stone-400 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-500">
      <span>© {new Date().getFullYear()} Thelawalaa POS</span>
      <span className="hidden sm:inline">Godam Chowk, Banepa</span>
      <span className={cn("flex items-center gap-1", online ? "text-green-600 dark:text-green-500" : "text-brand-red")} role="status">
        {online ? <Wifi size={12} /> : <WifiOff size={12} />}
        {online ? "Online" : "Offline — orders won't save"}
      </span>
    </footer>
  );
}
