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
    <header className="sticky top-0 z-50 border-b border-stone-200 bg-white/90 backdrop-blur shadow-sm">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <a href="/#home" className="flex items-center gap-2">
          <span className="font-display text-2xl font-extrabold text-brand-orange">Thelawalaa</span>
        </a>

        <ul className="hidden items-center gap-1 md:flex lg:gap-2">
          {LINKS.map(({ id, label }) => (
            <li key={id}>
              <a
                href={`/#${id}`}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-2 text-sm font-bold transition lg:px-5",
                  id === "order"
                    ? "bg-brand-orange text-white shadow hover:brightness-110"
                    : active === id
                      ? "text-brand-orange bg-orange-50"
                      : "text-stone-600 hover:text-brand-orange hover:bg-orange-50/50"
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
            className="hidden whitespace-nowrap rounded-full border-2 border-brand-orange px-3 py-2 text-sm font-bold text-brand-orange transition hover:bg-orange-50 md:inline-flex lg:px-5"
          >
            Login
          </Link>
          <button
            className="rounded-full p-2 text-stone-600 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-stone-200 bg-white px-4 pb-4 md:hidden shadow-lg">
          {LINKS.map(({ id, label }) => (
            <a
              key={id}
              href={`/#${id}`}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 font-bold text-stone-700 hover:bg-orange-50 hover:text-brand-orange"
            >
              {label}
            </a>
          ))}
          <Link href="/auth/login" className="mt-2 block rounded-full border-2 border-brand-orange px-4 py-3 text-center font-bold text-brand-orange hover:bg-orange-50">
            Login
          </Link>
        </div>
      )}
    </header>
  );
}
