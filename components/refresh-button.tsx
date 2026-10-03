"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Panels with their own live data (orders, stock) listen for this and re-sync. */
export const REFRESH_EVENT = "tw:refresh";

/**
 * Fetches everything on the screen again without a page reload — so a cart
 * being built on the POS, or a half-filled form, is kept.
 */
export default function RefreshButton({ className, iconSize = 15 }: { className?: string; iconSize?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [spin, setSpin] = useState(false);
  const busy = pending || spin;
  return (
    <button
      type="button"
      aria-label="Refresh"
      title="Refresh"
      disabled={busy}
      onClick={() => {
        setSpin(true);
        window.dispatchEvent(new Event(REFRESH_EVENT));
        start(() => router.refresh());
        setTimeout(() => setSpin(false), 800); // long enough to see it happened
      }}
      className={cn("flex items-center justify-center transition", className)}
    >
      <RefreshCw size={iconSize} className={cn(busy && "animate-spin")} />
    </button>
  );
}
