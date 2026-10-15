"use client";
import { useEffect, useState } from "react";
import { UI, clockText, type SiteLang } from "@/lib/site-lang";
import { cn } from "@/lib/utils";

const NPT_OFFSET_MS = (5 * 60 + 45) * 60_000; // Banepa is UTC+5:45 all year
const DAY_MS = 86_400_000;

/**
 * "Open now" / "Closed now · opens 9:00 am" from the store hours (minutes after
 * midnight, Banepa time). Worked out in the browser so a cached page is never
 * out of date; shows nothing until then (no server/browser mismatch).
 */
export default function OpenStatus({ start, end, lang, tone = "light", className }: {
  start: number; end: number; lang: SiteLang; tone?: "light" | "dark"; className?: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  if (now == null) return null;

  const minute = Math.floor(((now + NPT_OFFSET_MS) % DAY_MS) / 60_000);
  const open = minute >= start && minute < end;
  const L = UI[lang];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold",
      open
        ? tone === "dark" ? "bg-green-500/15 text-green-300" : "bg-green-50 text-green-700"
        : tone === "dark" ? "bg-white/10 text-amber-100/80" : "bg-stone-100 text-stone-600",
      className)}>
      <span aria-hidden className={cn("h-2 w-2 rounded-full", open ? "bg-green-500" : "bg-red-500")} />
      {open ? L.openNow : `${L.closedNow} · ${L.opens(clockText(start, lang), minute >= end)}`}
    </span>
  );
}
