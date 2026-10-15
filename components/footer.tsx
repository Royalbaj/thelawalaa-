import { Link2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FacebookGlyph, InstagramGlyph, TikTokGlyph, WhatsAppGlyph } from "@/components/icons/brand-glyphs";
import { getSiteText } from "@/lib/site-content";
import { UI, homePath, type SiteLang } from "@/lib/site-lang";
import BrandLogo from "@/components/brand-logo";

function platformIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p === "facebook") return FacebookGlyph;
  if (p === "instagram") return InstagramGlyph;
  if (p === "tiktok") return TikTokGlyph;
  if (p === "whatsapp") return WhatsAppGlyph;
  return Link2;
}

export default async function Footer({ lang = "en" }: { lang?: SiteLang }) {
  const supabase = await createClient();
  const [{ data: socialLinks }, t] = await Promise.all([
    supabase.from("social_links").select("id, platform, url").order("sort_order"),
    getSiteText(lang),
  ]);
  const L = UI[lang], home = homePath(lang);

  return (
    <footer className="bg-brand-brown px-4 py-12 text-white">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
        <div>
          <BrandLogo size="lg" tone="dark" tagline />
          <p className="mt-3 text-sm text-orange-100/80">{t["footer.tagline"]}</p>
          {(socialLinks ?? []).length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-orange-100/60">{L.footer.follow}</p>
              <div className="mt-2 flex gap-2">
                {(socialLinks ?? []).map((s) => {
                  const Icon = platformIcon(s.platform);
                  return (
                    <a
                      key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                      aria-label={`Thelawalaa on ${s.platform}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
                    >
                      <Icon size={16} />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <nav className="flex flex-wrap content-start gap-x-6 gap-y-2 text-sm font-bold text-orange-100/90">
          <a href={`${home}#home`} className="hover:text-white">{L.nav.home}</a>
          <a href={`${home}#menu`} className="hover:text-white">{L.nav.menu}</a>
          <a href="/order" className="hover:text-white">{L.footer.order}</a>
          <a href={`${home}#faq`} className="hover:text-white">{L.nav.faq}</a>
          <a href={`${home}#contact`} className="hover:text-white">{L.nav.contact}</a>
          <a href={`${home}#location`} className="hover:text-white">{L.nav.location}</a>
          <a href="/feedback" className="hover:text-white">{L.footer.feedback}</a>
        </nav>
        <div className="text-sm text-orange-100/70">
          <p className="font-bold"><a href="/terms" className="hover:text-white">{L.footer.terms}</a> · <a href="/terms#privacy" className="hover:text-white">{L.footer.privacy}</a></p>
          <p className="mt-2">© {new Date().getFullYear()} Thelawalaa.com — {L.footer.rights}</p>
        </div>
      </div>
    </footer>
  );
}
