"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

// A light/dark switch for one part of the site (Tailwind darkMode is
// "selector", so dark: styles apply only inside this wrapper). The choice is
// a cookie per device, read by the server so the first paint is right.
// `htmlClass` also marks <html> while this part is dark — for things outside
// the wrapper (the phone bottom bar in the root layout, the page background
// past the edges) — and is removed again when the part is left.
const ThemeContext = createContext<{ dark: boolean; toggle: () => void }>({ dark: false, toggle: () => {} });

/** Is the surrounding ThemeRoot dark? */
export const useTheme = () => useContext(ThemeContext);

export function ThemeRoot({ cookie, initialDark, htmlClass, className, children }: {
  cookie: string; initialDark: boolean; htmlClass?: string; className?: string; children: React.ReactNode;
}) {
  const [dark, setDark] = useState(initialDark);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.cookie = `${cookie}=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
  };
  useEffect(() => {
    if (!htmlClass) return;
    document.documentElement.classList.toggle(htmlClass, dark);
    return () => document.documentElement.classList.remove(htmlClass);
  }, [dark, htmlClass]);
  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      <div className={cn(className, dark && "dark")}>{children}</div>
    </ThemeContext.Provider>
  );
}

export function ThemeToggle({ className, labels }: { className?: string; labels?: { toDark: string; toLight: string } }) {
  const { dark, toggle } = useContext(ThemeContext);
  const label = dark ? labels?.toLight ?? "Switch to light mode" : labels?.toDark ?? "Switch to dark mode";
  return (
    <button type="button" onClick={toggle} aria-label={label} title={label}
      className={cn("flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white", className)}>
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
