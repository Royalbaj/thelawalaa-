"use client";
import { createContext, useContext, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

// A light/dark switch for one part of the site (Tailwind darkMode is
// "selector", so dark: styles apply only inside this wrapper). The choice is
// a cookie per device, read by the server so the first paint is right.
const ThemeContext = createContext<{ dark: boolean; toggle: () => void }>({ dark: false, toggle: () => {} });

export function ThemeRoot({ cookie, initialDark, className, children }: { cookie: string; initialDark: boolean; className?: string; children: React.ReactNode }) {
  const [dark, setDark] = useState(initialDark);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.cookie = `${cookie}=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      <div className={cn(className, dark && "dark")}>{children}</div>
    </ThemeContext.Provider>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { dark, toggle } = useContext(ThemeContext);
  return (
    <button onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Light mode" : "Dark mode"}
      className={cn("flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white", className)}>
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
