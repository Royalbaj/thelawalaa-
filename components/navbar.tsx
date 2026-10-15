"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Languages, ShoppingCart, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/store/cart";
import { useViewerRole } from "@/lib/use-viewer";
import { useSiteLang } from "@/lib/use-site-lang";
import { ROLE_HOME } from "@/lib/role-home";
import { UI, type SiteLang } from "@/lib/site-lang";
import BrandLogo from "@/components/brand-logo";

// "wide": only from lg, so the bar still fits on a tablet.
const LINKS = [
  { id: "home" },
  { id: "about", wide: true },
  { id: "menu" },
  { id: "order" },
  { id: "faq", wide: true },
  { id: "contact", wide: true },
  { id: "location" },
] as const;

// One navigation per screen size: the links live here on tablets and
// laptops; phones get the bottom bar (components/mobile-nav.tsx) instead,
// so this bar only keeps the logo, the language switch, the cart and the
// account button there. The homepage is English at / and Nepali at /ne.
export default function Navbar({ lang = "en" }: { lang?: SiteLang }) {
  const [active, setActive] = useState<string | null>(null);
  const itemCount = useCart((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const { role, ready } = useViewerRole();
  const { home, onHome } = useSiteLang();
  const L = UI[lang];
  const accountHref = role ? ROLE_HOME[role] ?? "/" : "/auth/login";
  const accountLabel = !role ? L.signIn : role === "customer" ? L.myAccount : L.myPortal;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-40% 0px -50% 0px" }
    );
    LINKS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200/80 bg-white/90 shadow-sm backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <a href={`${home}#home`} className="min-w-0">
          <BrandLogo size="sm" />
        </a>

        <ul className="hidden items-center gap-1 md:flex lg:gap-2">
          {LINKS.map((link) => (
            <li key={link.id} className={cn("wide" in link && "hidden lg:block")}>
              <a
                href={onHome ? `#${link.id}` : `${home}#${link.id}`}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold transition lg:px-4",
                  link.id === "order"
                    ? "bg-brand-orange text-white shadow hover:brightness-110"
                    : active === link.id
                      ? "bg-orange-50 text-brand-orange"
                      : "text-stone-600 hover:bg-orange-50/50 hover:text-brand-orange"
                )}
              >
                {L.nav[link.id]}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* English ⇄ नेपाली — on the homepage, the only page in both languages. */}
          {onHome && (
            <Link
              href={lang === "en" ? "/ne" : "/"}
              hrefLang={lang === "en" ? "ne" : "en"}
              lang={lang === "en" ? "ne" : "en"}
              aria-label={L.switchAria}
              className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-stone-100 px-3 text-sm font-bold text-brand-brown transition hover:bg-orange-50 hover:text-brand-orange"
            >
              <Languages size={16} className="hidden lg:block" aria-hidden />
              {L.switchTo}
            </Link>
          )}
          <Link
            href="/order"
            aria-label={`Your cart${itemCount > 0 ? `, ${itemCount} item${itemCount > 1 ? "s" : ""}` : ""}`}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-stone-600 transition hover:bg-orange-50 hover:text-brand-orange"
          >
            <ShoppingCart size={20} />
            {itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-bold text-white">
                {itemCount > 9 ? "9+" : itemCount}
              </span>
            )}
          </Link>
          <Link
            href={accountHref}
            aria-label={accountLabel}
            className={cn(
              "flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-brand-orange px-3 text-sm font-bold text-brand-orange transition hover:bg-orange-50 lg:px-4",
              !ready && "invisible"
            )}
          >
            <UserRound size={16} className="md:hidden" />
            <span className="hidden sm:inline">{accountLabel}</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
