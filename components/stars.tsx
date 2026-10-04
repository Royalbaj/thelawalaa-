import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** A 1–5 rating shown as stars (display only). */
export default function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= value ? "fill-amber-400 text-amber-400" : "fill-stone-200 text-stone-200"} />
      ))}
    </span>
  );
}
