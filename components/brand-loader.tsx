import { cn } from "@/lib/utils";

// The loading animation: the "TW" tile pops in, a light sheen sweeps across
// it and a ring in the brand gradient spins round it. Shown only after a
// moment (.tw-loader-in), so quick page changes never flash it. Animations
// live in app/globals.css (tw-*) and stop for prefers-reduced-motion.

function Tile({ size }: { size: number }) {
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size + 22, height: size + 22 }}>
      <span aria-hidden className="tw-loader-ring absolute inset-0 rounded-full" />
      <span
        aria-hidden
        className="tw-loader-tile inline-flex items-center justify-center bg-gradient-to-br from-brand-orange to-brand-red font-display font-extrabold leading-none text-brand-cream shadow-[0_10px_30px_-8px_rgba(220,38,38,0.6)]"
        style={{ width: size, height: size, borderRadius: Math.round(size * 0.26), fontSize: Math.round(size * 0.42) }}
      >
        <span className="tw-letter">T</span><span className="tw-letter tw-letter-2">W</span>
      </span>
    </span>
  );
}

/** Inline loader for a part of a page (a list, a panel, the content area). */
export function BrandLoader({ label = "Loading…", size = 52, dark = false, className }: { label?: string; size?: number; dark?: boolean; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("tw-loader-in flex flex-col items-center justify-center gap-3", className)}>
      <Tile size={size} />
      <p className={cn("text-sm font-bold", dark ? "text-white/60" : "text-stone-500")}>{label}</p>
    </div>
  );
}

/** Full-screen splash — the first load of a page and big moves between sections. */
export function BrandSplash({ dark = false }: { dark?: boolean }) {
  return (
    <div role="status" aria-label="Loading Thelawalaa"
      className={cn("tw-loader-in fixed inset-0 z-[100] flex flex-col items-center justify-center", dark ? "bg-stone-950" : "bg-brand-cream")}>
      <Tile size={72} />
      <p className={cn("tw-loader-word mt-5 font-display text-3xl font-extrabold tracking-tight", dark ? "text-brand-cream" : "text-brand-brown")}>Thelawalaa</p>
      <p className="tw-loader-tag mt-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-brand-orange">Where taste meets hygiene</p>
      <span aria-hidden className={cn("tw-loader-bar relative mt-6 h-1 w-40 overflow-hidden rounded-full", dark ? "bg-white/10" : "bg-orange-100")} />
    </div>
  );
}
