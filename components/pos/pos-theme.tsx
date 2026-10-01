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
      {/* h-dvh: the height Safari actually shows (100vh hides the bottom under its toolbar).
          Safe-area padding: clear of the iPhone home bar / notch (layout sets viewportFit cover).
          touch-action: no double-tap zoom on a tapping-heavy screen.
          select-none for the taps, but inputs opt back in — older iOS won't type into them otherwise. */}
      <div className={cn(
        "flex h-dvh flex-col overflow-hidden bg-brand-cream text-stone-900 [touch-action:manipulation] select-none dark:bg-stone-950 dark:text-stone-100",
        "pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] [&_input]:select-text",
        dark && "dark",
      )}>
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
