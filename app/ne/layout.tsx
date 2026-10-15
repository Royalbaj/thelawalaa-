import { cookies } from "next/headers";
import { Mukta, Poppins } from "next/font/google";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { ThemeRoot } from "@/components/theme-toggle";
import { SITE_THEME_COOKIE } from "@/lib/site-lang";

// The Nepali homepage. Poppins has Devanagari letters (headings, same look as the
// English site); Nunito doesn't, so the text here is Mukta, made for Nepali.
const display = Poppins({ subsets: ["latin", "devanagari"], weight: ["500", "600", "700", "800"], variable: "--font-display", display: "swap" });
const body = Mukta({ subsets: ["latin", "devanagari"], weight: ["400", "500", "600", "700", "800"], variable: "--font-body", display: "swap" });

export default async function NepaliLayout({ children }: { children: React.ReactNode }) {
  const dark = (await cookies()).get(SITE_THEME_COOKIE)?.value === "dark";
  return (
    <div lang="ne" className={`${display.variable} ${body.variable} font-body`}>
      <ThemeRoot cookie={SITE_THEME_COOKIE} initialDark={dark} htmlClass="site-dark"
        className="bg-brand-cream text-stone-900 dark:bg-stone-950 dark:text-stone-100">
        <Navbar lang="ne" />
        <main>{children}</main>
        <Footer lang="ne" />
      </ThemeRoot>
    </div>
  );
}
