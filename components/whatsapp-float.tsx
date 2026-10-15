"use client";
import { useEffect, useState } from "react";
import { WhatsAppGlyph } from "@/components/icons/brand-glyphs";
import { cn } from "@/lib/utils";

/**
 * The round WhatsApp button in the corner of the homepage. It comes in only
 * once the top of the page (#home) has scrolled away: on a phone it used to
 * sit on top of the hero's buttons, which have their own ways to order.
 */
export default function WhatsAppFloat({ href, label }: { href: string; label: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("home");
    if (!hero) { setShow(true); return; }
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting), { rootMargin: "-120px 0px 0px 0px" });
    io.observe(hero);
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
