"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Faq({ faqs }: { faqs: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="mt-8 space-y-3">
      {faqs.map(({ q, a }, i) => (
        <div key={q} className="card overflow-hidden">
          <button
            className="flex w-full items-center justify-between px-5 py-4 text-left font-bold"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            {q}
            <ChevronDown className={cn("h-5 w-5 shrink-0 text-brand-orange transition-transform", open === i && "rotate-180")} />
          </button>
          {/* Answer is always in the DOM for crawlers; visually collapsed when closed */}
          <p className={cn("px-5 text-sm text-stone-600", open === i ? "pb-4" : "sr-only")}>{a}</p>
        </div>
      ))}
    </div>
  );
}
