"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { RANGES, type RangeKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Preset chips (Today, This week, …) plus "Pick dates" — all in the URL, so a period can be bookmarked or shared. */
export default function RangePicker({ current, from, to, keys, keep = {} }: {
  current: RangeKey; from: string; to: string; keys: RangeKey[]; keep?: Record<string, string | undefined>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [custom, setCustom] = useState(current === "custom");
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  const href = (params: Record<string, string>) => {
    const q = new URLSearchParams();
    Object.entries(keep).forEach(([k, v]) => { if (v) q.set(k, v); });
    Object.entries(params).forEach(([k, v]) => q.set(k, v));
    return `${pathname}?${q}`;
  };
  const chip = (active: boolean) => cn("shrink-0 touch-manipulation rounded-full px-3.5 py-2 text-sm font-bold transition",
    active ? "bg-brand-brown text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-orange-50");

  return (
    <div className="space-y-2">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
        {keys.filter((k) => k !== "custom").map((k) => (
          <Link key={k} href={href({ range: k })} className={chip(current === k)} scroll={false}>{RANGES[k]}</Link>
        ))}
        <button onClick={() => setCustom((v) => !v)} className={cn(chip(current === "custom"), "flex items-center gap-1.5")}>
          <CalendarRange size={14} /> {RANGES.custom}
        </button>
      </div>
      {custom && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-2xl bg-white p-3 ring-1 ring-stone-200"
          onSubmit={(e) => { e.preventDefault(); if (f && t) router.push(href({ range: "custom", from: f, to: t }), { scroll: false }); }}
        >
          <label className="text-xs font-bold text-stone-500">From
            <input type="date" value={f} onChange={(e) => setF(e.target.value)} className="input mt-1 !py-2 text-base sm:text-sm" required />
          </label>
          <label className="text-xs font-bold text-stone-500">To
            <input type="date" value={t} onChange={(e) => setT(e.target.value)} className="input mt-1 !py-2 text-base sm:text-sm" required />
          </label>
          <button className="btn-primary !px-5 !py-2.5 text-sm">Show</button>
        </form>
      )}
    </div>
  );
}
