import { cookies } from "next/headers";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { ThemeRoot } from "@/components/theme-toggle";
import { SITE_THEME_COOKIE } from "@/lib/site-lang";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Light / dark (the moon button in the top bar), remembered per device.
  const dark = (await cookies()).get(SITE_THEME_COOKIE)?.value === "dark";
  return (
    <ThemeRoot cookie={SITE_THEME_COOKIE} initialDark={dark} htmlClass="site-dark"
      className="bg-brand-cream text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <Navbar lang="en" />
      <main>{children}</main>
      <Footer lang="en" />
    </ThemeRoot>
  );
}
