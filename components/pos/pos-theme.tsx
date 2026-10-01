"use client";
import { createContext, useContext, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { POS_THEME_COOKIE } from "@/lib/pos-theme";

// The POS defaults to dark. The choice is kept in a cookie (per device) so
// the server renders the right theme from the first frame — no flash.
const ThemeContext = createContext<{ dark: boolean; toggle: () => void }>({ dark: true, toggle: () => {} });

export function PosThemeRoot({ initialDark, children }: { initialDark: boolean; children: React.ReactNode }) {
  const [dark, setDark] = useState(initialDark);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.cookie = `${POS_THEME_COOKIE}=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      <div className={cn("flex h-screen flex-col overflow-hidden bg-brand-cream text-stone-900 dark:bg-stone-950 dark:text-stone-100", dark && "dark")}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function PosThemeToggle() {
  const { dark, toggle } = useContext(ThemeContext);
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition hover:bg-white/20 hover:text-white"
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
