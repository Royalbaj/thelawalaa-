"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { homePath, langOfPath, type SiteLang } from "@/lib/site-lang";

const KEY = "tw-lang";

/**
 * The page's language (from its URL) and where "Home" should lead: the
 * homepage in the language this visitor last opened, so someone reading in
 * Nepali comes back to /ne from /order. Remembered in this browser only.
 */
export function useSiteLang() {
  const pathname = usePathname();
  const lang = langOfPath(pathname);
  const onHome = pathname === "/" || pathname === "/ne";
  const [pref, setPref] = useState<SiteLang>(lang);

  useEffect(() => {
    try {
      if (onHome) localStorage.setItem(KEY, lang);
      setPref(onHome ? lang : localStorage.getItem(KEY) === "ne" ? "ne" : "en");
    } catch {
      setPref(lang);
    }
  }, [onHome, lang]);

  return { lang, onHome, home: homePath(pref) };
}
