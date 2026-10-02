"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

type Cat = { id: string; kind: "in" | "out"; name: string };

/** Type / category / text / missing-bill filters — kept in the URL next to the date range. */
export default function EntryFilters({ params, categories }: { params: Record<string, string | undefined>; categories: Cat[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(params.q ?? "");

  const go = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    Object.entries({ ...params, ...patch }).forEach(([k, v]) => { if (v) next.set(k, v); });
    router.push(`${pathname}?${next}`, { scroll: false });
  };
  const kind = params.kind;
  const cats = categories.filter((c) => !kind || c.kind === kind);
  const seg = (active: boolean) => cn("flex-1 touch-manipulation rounded-lg px-3 py-2 text-sm font-bold transition",
    active ? "bg-white text-brand-brown shadow-sm" : "text-stone-500");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-xl bg-stone-200/60 p-1">
        {([[undefined, "All"], ["in", "Money in"], ["out", "Money out"]] as const).map(([k, label]) => (
          <button key={label} onClick={() => go({ kind: k, cat: undefined })} className={seg(kind === k)}>{label}</button>
        ))}
      </div>
      <select value={params.cat ?? ""} onChange={(e) => go({ cat: e.target.value || undefined })}
        className="input !w-auto min-w-[10rem] !py-2 text-base sm:text-sm" aria-label="Category">
        <option value="">All categories</option>
        {cats.map((c) => <option key={c.id} value={c.id}>{c.name}{kind ? "" : c.kind === "in" ? " (in)" : " (out)"}</option>)}
      </select>
      <form onSubmit={(e) => { e.preventDefault(); go({ q: q.trim() || undefined }); }} className="relative min-w-[12rem] flex-1">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes" maxLength={60}
          className="input !py-2 !pl-9 !pr-9 text-base sm:text-sm" enterKeyHint="search" />
        {params.q && (
          <button type="button" onClick={() => { setQ(""); go({ q: undefined }); }} aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-stone-400"><X size={15} /></button>
        )}
      </form>
      <button onClick={() => go({ nobill: params.nobill ? undefined : "1" })} aria-pressed={!!params.nobill}
        className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold ring-1 transition",
          params.nobill ? "bg-amber-100 text-amber-800 ring-amber-300" : "bg-white text-stone-600 ring-stone-200")}>
        <Paperclip size={14} /> No bill
      </button>
    </div>
  );
}
