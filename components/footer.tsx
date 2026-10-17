import Link from "next/link";
import { Clock, Link2, MapPin, Navigation } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FacebookGlyph, InstagramGlyph, TikTokGlyph, WhatsAppGlyph } from "@/components/icons/brand-glyphs";
import { getSiteText, whatsappHref } from "@/lib/site-content";
import { storeHours } from "@/lib/delivery-hours";
import { deliveryArea, directionsUrl } from "@/lib/geo";
import { UI, homePath, hoursText, type SiteLang } from "@/lib/site-lang";
import BrandLogo from "@/components/brand-logo";

function platformIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p === "facebook") return FacebookGlyph;
  if (p === "instagram") return InstagramGlyph;
  if (p === "tiktok") return TikTokGlyph;
  if (p === "whatsapp") return WhatsAppGlyph;
  return Link2;
}

const heading = "text-xs font-bold uppercase tracking-[0.18em] text-orange-200/60";
const link = "text-orange-100/85 transition hover:text-white";

/**
 * The website footer (English and Nepali pages, light and dark): brand +
 * socials, two link columns, where to find us with today's hours, and a
 * bottom line. `data-site-footer` makes the phone bottom bar drop its own
 * spacer (globals.css) — the footer's bottom padding leaves room for the bar,
 * so the brown runs right to the bottom of the screen — and keeps the round
 * WhatsApp button off it.
 */
export default async function Footer({ lang = "en" }: { lang?: SiteLang }) {
  const supabase = await createClient();
  const [{ data: socialLinks }, { data: settings }, t] = await Promise.all([
    supabase.from("social_links").select("id, platform, url").order("sort_order"),
    // "*": the store-hours columns (migration 046) may be missing on an old database — the defaults cover that.
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    getSiteText(lang),
  ]);
  const L = UI[lang], F = L.footer, home = homePath(lang);
  const hours = storeHours(settings);

  return (
    <footer data-site-footer className="bg-brand-brown text-orange-50 dark:border-t dark:border-white/5">
      <div className="mx-auto max-w-6xl px-4 pb-[calc(env(safe-area-inset-bottom)+7.5rem)] pt-14 sm:px-6 md:pb-10 md:pt-16">
        <div className="grid gap-10 md:grid-cols-12 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-4">
            <BrandLogo size="lg" tone="dark" tagline />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-orange-100/75">{t["footer.tagline"]}</p>
            {(socialLinks ?? []).length > 0 && (
              <div className="mt-6">
                <p className={heading}>{F.follow}</p>
                <div className="mt-3 flex gap-2">
                  {(socialLinks ?? []).map((s) => {
                    const Icon = platformIcon(s.platform);
                    return (
                      <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={`Thelawalaa on ${s.platform}`}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10 transition hover:bg-white/20">
                        <Icon size={17} />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Links — side by side on phones too */}
          <div className="grid grid-cols-2 gap-8 md:col-span-4">
            <nav aria-label={F.explore}>
              <h2 className={heading}>{F.explore}</h2>
              <ul className="mt-4 space-y-3 text-sm font-semibold">
                <li><a href={`${home}#menu`} className={link}>{L.nav.menu}</a></li>
                <li><a href={`${home}#order`} className={link}>{F.howToOrder}</a></li>
                <li><a href={`${home}#about`} className={link}>{L.nav.about}</a></li>
                <li><a href={`${home}#faq`} className={link}>{L.nav.faq}</a></li>
                <li><Link href="/careers" className={link}>{F.careers}</Link></li>
              </ul>
            </nav>
            <nav aria-label={F.help}>
              <h2 className={heading}>{F.help}</h2>
              <ul className="mt-4 space-y-3 text-sm font-semibold">
                <li><Link href="/order" className={link}>{F.orderOnline}</Link></li>
                <li><a href={`${home}#contact`} className={link}>{L.nav.contact}</a></li>
                <li><Link href="/feedback" className={link}>{F.feedback}</Link></li>
                <li><a href={whatsappHref(t)} target="_blank" rel="noopener noreferrer" className={link}>WhatsApp</a></li>
              </ul>
            </nav>
          </div>

          {/* Visit us */}
          <div className="md:col-span-4">
            <h2 className={heading}>{F.visit}</h2>
            <ul className="mt-4 space-y-3.5 text-sm">
              <li className="flex gap-3">
                <MapPin size={18} className="mt-0.5 shrink-0 text-brand-orange" aria-hidden />
                <span>
                  <span className="block font-bold text-orange-50">{t["contact.kitchen"]}</span>
                  <span className="text-orange-100/75">{t["contact.address"]}</span>
                </span>
              </li>
              <li className="flex gap-3">
                <Clock size={18} className="mt-0.5 shrink-0 text-brand-orange" aria-hidden />
                <span className="text-orange-100/75">{t["contact.hours_days"]} · {hoursText(hours.start, hours.end, lang)}</span>
              </li>
            </ul>
            <div className="mt-5 flex flex-wrap gap-2">
              <a href={directionsUrl(deliveryArea(settings).shop)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold ring-1 ring-white/10 transition hover:bg-white/20">
                <Navigation size={14} className="text-brand-orange" aria-hidden /> {t["location.directions"]}
              </a>
              <a href={whatsappHref(t)} target="_blank" rel="noopener noreferrer" aria-label={F.chat}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold ring-1 ring-white/10 transition hover:bg-white/20">
                <WhatsAppGlyph size={15} /> WhatsApp
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-orange-100/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Thelawalaa.com — {F.rights}</p>
          <p className="flex gap-5 font-semibold">
            <Link href="/terms" className="transition hover:text-white">{F.terms}</Link>
            <Link href="/terms#privacy" className="transition hover:text-white">{F.privacy}</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
