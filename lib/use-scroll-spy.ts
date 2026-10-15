"use client";
import { useEffect, useState } from "react";

/**
 * Which homepage section the visitor is looking at — the last one (ids in page
 * order) whose top has passed a line a third of the way down the screen, or
 * the last one once the page is scrolled to the bottom. The top bar and the
 * phone bottom bar both use it to light up the right link.
 */
export function useScrollSpy(ids: readonly string[], enabled = true) {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join(",");

  useEffect(() => {
    if (!enabled) { setActive(null); return; }
    const list = key.split(",");
    let raf = 0;
    const check = () => {
      raf = 0;
      const line = window.innerHeight * 0.34;
      let current: string | null = null;
      for (const id of list) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
      if (atBottom && document.getElementById(list[list.length - 1])) current = list[list.length - 1];
      setActive(current);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [key, enabled]);

  return active;
}

/** The homepage sections, top to bottom. */
export const HOME_SECTIONS = ["home", "about", "menu", "order", "faq", "contact", "location"] as const;
