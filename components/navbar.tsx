"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/store/cart";
import { useViewerRole } from "@/lib/use-viewer";
import { ROLE_HOME } from "@/lib/role-home";
import BrandLogo from "@/components/brand-logo";

const LINKS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "menu", label: "Menu" },
  { id: "order", label: "Order Now" },
  { id: "faq", label: "FAQ" },
  { id: "contact", label: "Contact" },
];

// One navigation per screen size: the links live here on tablets and
// laptops; phones get the bottom bar (components/mobile-nav.tsx) instead,
// so this bar only keeps the logo, the cart and the account button there.
export default function Navbar() {
  const [active, setActive] = useState<string | null>(null);
  const itemCount = useCart((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const { role, ready } = useViewerRole();
  const accountHref = role ? ROLE_HOME[role] ?? "/" : "/auth/login";
  const accountLabel = !role ? "Sign in" : role === "customer" ? "My account" : "My portal";

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
        <a href="/#home" aria-label="Thelawalaa home" className="min-w-0">
          <BrandLogo size="sm" />
        </a>

        <ul className="hidden items-center gap-1 md:flex lg:gap-2">
          {LINKS.map(({ id, label }) => (
            <li key={id}>
              <a
                href={`/#${id}`}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold transition lg:px-4",
                  id === "order"
                    ? "bg-brand-orange text-white shadow hover:brightness-110"
                    : active === id
                      ? "bg-orange-50 text-brand-orange"
                      : "text-stone-600 hover:bg-orange-50/50 hover:text-brand-orange"
                )}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-1.5">
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
