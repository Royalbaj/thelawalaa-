"use client";
import { useEffect, useState } from "react";
import { WhatsAppGlyph } from "@/components/icons/brand-glyphs";
import { cn } from "@/lib/utils";

/**
 * The round WhatsApp button in the corner of the homepage. It shows only
 * between the hero and the footer: on a phone it used to sit on top of the
 * hero's buttons and the footer's text, and both have their own WhatsApp /
 * order links anyway.
 */
export default function WhatsAppFloat({ href, label }: { href: string; label: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("home");
    const footer = document.querySelector("[data-site-footer]");
    const inView = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) inView.set(e.target, e.isIntersecting);
      setShow(!(hero && inView.get(hero)) && !(footer && inView.get(footer)));
    }, { rootMargin: "-120px 0px 0px 0px" });
    if (hero) io.observe(hero);
    if (footer) io.observe(footer);
    if (!hero && !footer) setShow(true);
    return () => io.disconnect();
  }, []);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      aria-hidden={!show}
      tabIndex={show ? undefined : -1}
      className={cn("fixed bottom-32 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition duration-300 hover:scale-105 md:bottom-6 md:right-6",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0")}
    >
      <WhatsAppGlyph size={28} />
    </a>
  );
}
