import { cn } from "@/lib/utils";

// The official Thelawalaa logo (as in public/images/email/logo.png): the
// orange→red "TW" tile and the brown wordmark — cream on dark backgrounds.
// Every screen that shows the name at the top uses this, never plain text.

const SIZES = {
  sm: { mark: 30, word: "text-lg", tag: "text-[8px]" },
  md: { mark: 36, word: "text-xl", tag: "text-[9px]" },
  lg: { mark: 44, word: "text-2xl", tag: "text-[10px]" },
} as const;

export function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 select-none items-center justify-center bg-gradient-to-br from-brand-orange to-brand-red font-display font-extrabold leading-none tracking-tight text-brand-cream shadow-[0_4px_14px_-4px_rgba(220,38,38,0.55)]", className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.26), fontSize: Math.round(size * 0.42) }}
    >
      TW
    </span>
  );
}

export default function BrandLogo({
  size = "md", tone = "light", tagline = false, label, className,
}: {
  size?: keyof typeof SIZES;
  /** "dark" on dark backgrounds: the wordmark turns cream so it stays readable. */
  tone?: "light" | "dark";
  tagline?: boolean;
  /** A small tag after the name, e.g. "POS" or "Driver". */
  label?: string;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <BrandMark size={s.mark} />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="flex items-center gap-1.5">
          <span className={cn("font-display font-extrabold tracking-tight", s.word, tone === "dark" ? "text-brand-cream" : "text-brand-brown")}>Thelawalaa</span>
          {label && (
            <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider",
              tone === "dark" ? "bg-white/10 text-orange-200" : "bg-orange-50 text-brand-orange")}>{label}</span>
          )}
        </span>
        {tagline && <span className={cn("mt-1 font-bold uppercase tracking-[0.22em] text-brand-orange", s.tag)}>Where flavour meets hygiene</span>}
      </span>
    </span>
  );
}
