"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "menu", label: "Menu" },
  { id: "order", label: "Order Now" },
  { id: "faq", label: "FAQ" },
  { id: "contact", label: "Contact" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("home");

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
    <header className="sticky top-0 z-50 border-b border-orange-900/30 bg-brand-dark/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <a href="#home" className="flex items-center gap-2">
          <span aria-hidden className="text-2xl">🥘</span>
          <span className="font-display text-xl font-bold brand-gradient-text">Thelawalaa</span>
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map(({ id, label }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-bold transition",
                  id === "order"
                    ? "bg-brand-orange text-white hover:brightness-110"
                    : active === id
                      ? "text-brand-orange"
                      : "text-white/80 hover:text-white"
                )}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            href="/auth/login"
            className="hidden rounded-full border-2 border-white/70 px-5 py-2 text-sm font-bold text-white transition hover:bg-white/10 md:inline-flex"
          >
            Login
          </Link>
          <button
            className="rounded-full p-2 text-white md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-orange-900/30 bg-brand-dark px-4 pb-4 md:hidden">
          {LINKS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 font-bold text-white/90 hover:bg-white/10"
            >
              {label}
            </a>
          ))}
          <Link href="/auth/login" className="mt-2 block rounded-full border-2 border-white/70 px-4 py-3 text-center font-bold text-white">
            Login
          </Link>
        </div>
      )}
    </header>
  );
}
