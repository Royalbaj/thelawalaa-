import Link from "next/link";
import Image from "next/image";
import { Bike, Clock, MapPin, Navigation, UtensilsCrossed } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn, npr } from "@/lib/utils";
import { applyOpeningPromoPrice, isOpeningPromoActive } from "@/lib/promo";
import { getSiteText, whatsappHref } from "@/lib/site-content";
import { storeHours } from "@/lib/delivery-hours";
import { deliveryArea, directionsUrl, embedUrl } from "@/lib/geo";
import { DEFAULT_HOWTO_VIDEO, ownMediaUrl } from "@/lib/site-media";
import { UI, hoursText, type SiteLang } from "@/lib/site-lang";
import heroImage from "@/public/images/hero/thelawalaa-momo-chatpate-boxes.webp";
import ContactForm from "@/components/contact-form";
import Faq from "@/components/faq";
import AddToCartButton from "@/components/add-to-cart-button";
import StructuredData from "@/components/structured-data";
import HeroSteam from "@/components/hero-steam";
import OpenStatus from "@/components/open-status";
import { HowToVideo, HowToVideoButton } from "@/components/how-to-video";
import { WhatsAppGlyph } from "@/components/icons/brand-glyphs";
import WhatsAppFloat from "@/components/whatsapp-float";

/**
 * The homepage, in English (/) or Nepali (/ne). Every bit of wording is
 * editable in Admin → Website text (lib/site-content.ts, with a Nepali box per
 * field); the small fixed words are in lib/site-lang.ts. Menu items and FAQs
 * come from the database and stay as typed there.
 */
// Mild → Extra hot, light to dark (the spice meter on the bestseller cards).
const SPICE_COLOUR = ["bg-amber-400", "bg-orange-500", "bg-red-500", "bg-red-700"];

export default async function HomePage({ lang }: { lang: SiteLang }) {
  const supabase = await createClient();
  const [{ data: bestsellers }, { data: menuItems }, { data: announcement }, { data: settings }, { data: faqRows }, t] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, description, price, spice_level, is_veg, image_url, categories(name)")
      .eq("is_bestseller", true)
      .eq("pos_only", false)
      .order("sort_order")
      .limit(4),
    supabase
      .from("products")
      .select("name, description, price")
      .eq("is_available", true)
      .eq("pos_only", false)
      .order("sort_order")
      .limit(50),
    supabase
      .from("announcements")
      .select("message, link_url")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // "*": the store-hours columns (migration 046) may not exist yet — the defaults cover that.
    supabase.from("app_settings").select("*").eq("id", 1).single(),
    supabase.from("faqs").select("question, answer").eq("is_active", true).order("sort_order"),
    getSiteText(lang),
  ]);
  const L = UI[lang];
  const count = (bestsellers ?? []).length;
  const faqs = (faqRows ?? []).map((f) => ({ q: f.question, a: f.answer }));
  const deliveryEnabled = settings?.delivery_enabled ?? false;
  const promoActive = isOpeningPromoActive(settings);
  const priceOf = (p: { price: number; categories?: { name: string } | { name: string }[] | null }) => {
    const catName = Array.isArray(p.categories) ? p.categories[0]?.name : p.categories?.name;
    return applyOpeningPromoPrice(Number(p.price), catName ?? null, settings);
  };
  // Opening hours = the store hours that decide when orders are taken (Admin → Settings → Store hours).
  const hours = storeHours(settings);
  const hoursLine = `${t["contact.hours_days"]} · ${hoursText(hours.start, hours.end, lang)}`;
  // The shop's spot as set in Admin → Settings → Delivery area (else lib/seo.ts's approximate one).
  const shop = deliveryArea(settings).shop;
  const directions = directionsUrl(shop);
  // The how-to-order video (Admin → Website text): our own file, "off" hides it and its button.
  const videoOff = t["order.video"].trim().toLowerCase() === "off";
  const video = videoOff ? null : {
    src: ownMediaUrl(t["order.video"], "video") ?? DEFAULT_HOWTO_VIDEO,
    poster: ownMediaUrl(t["order.video_poster"], "image"),
    title: t["order.video_title"],
    lang,
  };

  return (
    <>
      {/* FAQs are English-only, so their rich result belongs to the English page. */}
      <StructuredData faqs={lang === "en" ? faqs : []} menu={(menuItems ?? []).map((m) => ({ name: m.name, description: m.description, price: Number(m.price) }))} />

      {/* HERO — the dark product photo melts into a background matched to its
          own edges (#0e0805, warm light from the left like the photo), via
          overlays in the same colour. Phones: photo on top, text below.
          Wide screens: text on the left, photo bleeding off the right edge. */}
      <section id="home" className="relative overflow-hidden bg-[#0e0805] text-amber-50">
        {/* Ambient backdrop: the photo's own tiny blur preview, stretched over the whole
            hero and darkened — everything around the photo is made of its colours,
            so the sharp photo sits in it with no visible "photo area". */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -inset-16 scale-110 bg-cover bg-center opacity-70 blur-3xl"
            style={{ backgroundImage: `url(${heroImage.blurDataURL})` }} />
          <div className="absolute inset-0 bg-[#0e0805]/55" />
          {/* Text side: darker for reading (phones: lower part, under the photo) */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0e0805]/70 to-[#0e0805] lg:bg-gradient-to-r lg:from-[#0e0805] lg:via-[#0e0805]/80 lg:to-transparent" />
        </div>
        {/* Only a real announcement (Admin → Announcements) — no filler line. */}
        {announcement?.message && (
          <div className="relative z-20 border-b border-white/10 bg-black/40 px-4 py-2.5 text-center text-sm font-bold text-amber-100">
            {announcement.link_url ? (
              <a href={announcement.link_url} className="underline-offset-4 hover:underline">{announcement.message}</a>
            ) : announcement.message}
          </div>
        )}

        <div className="relative mx-auto max-w-7xl lg:flex lg:min-h-[min(600px,calc(100svh-4rem))] lg:items-center lg:static">
          {/* Photo. Phones/tablets: full width on top. Wide screens: whole 3:2 shot
              on the right, reaching the screen edge, faded on its other sides. */}
          <div className="relative lg:absolute lg:inset-y-0 lg:right-0 lg:flex lg:w-[60%] lg:max-w-[1100px] lg:items-center">
            {/* hero-photo-fade (globals.css) fades the photo itself out at its edges,
                so the background shows through — no seam, whatever the colours. */}
            <div className="hero-photo-fade relative aspect-[3/2] w-full">
              <Image
                src={heroImage}
                alt={L.heroAlt}
                fill
                priority
                placeholder="blur"
                sizes="(min-width: 1834px) 1100px, (min-width: 1024px) 60vw, 100vw"
                className="object-cover"
              />
              {/* Live steam off the momo — placed in the photo's own coordinates (3:2):
                  the momo box is the right-hand one; the plume starts at the momo tops. */}
              <HeroSteam className="pointer-events-none absolute left-[47%] top-0 h-[58%] w-[46%]" />
            </div>
          </div>

          {/* Warm glow over everything (text side and photo alike, so no seam), like the photo's own light */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_15%_55%,rgba(235,104,52,0.14),transparent_70%)]" />

          {/* Words — only what matters, so the whole dark part fits on one screen
              (owner's call): the headline, one line about us, Order + how-to video,
              and where & when ONCE (the short location opens directions). */}
          <div className="relative z-10 -mt-14 px-4 pb-[4.5rem] text-center sm:-mt-16 lg:mt-0 lg:w-[44%] lg:py-16 lg:pl-8 lg:text-left xl:w-[46%] xl:pl-4">
            <h1 className={cn("font-display text-4xl font-extrabold text-amber-50 sm:text-5xl md:text-6xl",
              lang === "ne" ? "leading-snug lg:text-5xl xl:text-6xl" : "leading-tight lg:text-5xl xl:text-7xl")}>
              {t["hero.title"]}
              <span className="brand-gradient-text"> {t["hero.highlight"]}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-lg whitespace-pre-line text-base leading-relaxed text-amber-100/75 sm:text-lg lg:mx-0">
              {t["hero.text"]}
            </p>
            <div className="mx-auto mt-7 grid max-w-xs gap-3 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center lg:justify-start">
              <Link href="/order" className="btn-primary px-8 py-3.5 text-lg shadow-lg shadow-orange-600/40">
                {t["hero.button"]}
              </Link>
              {video && <HowToVideoButton {...video} label={t["hero.video_button"]} />}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-bold lg:justify-start">
              <a href={directions} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-amber-50 underline-offset-4 hover:underline">
                <MapPin size={16} className="shrink-0 text-brand-orange" aria-hidden />
                {t["hero.eyebrow"]}
              </a>
              <span className="inline-flex flex-wrap items-center justify-center gap-2 text-amber-100/75">
                <OpenStatus start={hours.start} end={hours.end} lang={lang} tone="dark" />
                {hoursLine}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip: a white card straddling the hero's straight bottom edge (top
          3.5rem sits over the dark hero, the rest over the white section below). */}
      <div className="relative z-10 -mt-14 bg-[linear-gradient(to_bottom,transparent_3.5rem,#fff_3.5rem)] px-4 dark:bg-[linear-gradient(to_bottom,transparent_3.5rem,#0c0a09_3.5rem)]">
        <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-2xl bg-stone-100 shadow-xl shadow-stone-900/10 ring-1 ring-stone-200/70 dark:bg-stone-800 dark:shadow-black/40 dark:ring-stone-800 md:grid-cols-4">
          {[t["hero.badge1"], t["hero.badge2"], deliveryEnabled ? t["hero.badge3_delivery"] : t["hero.badge3_pickup"], t["hero.badge4"]].map((text) => (
            <li key={text} className="bg-white px-5 py-5 dark:bg-stone-900 sm:px-6">
              <span aria-hidden className="block h-0.5 w-8 rounded-full bg-brand-orange" />
              <span className="mt-3 block text-sm font-bold leading-snug text-brand-brown dark:text-orange-50">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* WHY THELAWALAA */}
      <section id="about" className="bg-white px-4 dark:bg-stone-950 pb-12 pt-10 md:pb-20 md:pt-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <p className="font-bold tracking-widest text-brand-orange text-xs mb-2 uppercase">{t["about.eyebrow"]}</p>
            <h2 className="font-display text-3xl font-bold text-brand-brown dark:text-orange-50 md:text-4xl">{t["about.title"]}</h2>
            <p className="mt-4 max-w-2xl mx-auto whitespace-pre-line text-stone-600 dark:text-stone-300 leading-relaxed">
              {t["about.text"]}
            </p>
          </div>
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [t["about.card1_title"], t["about.card1_text"]],
              [t["about.card2_title"], t["about.card2_text"]],
              [t["about.card3_title"], t["about.card3_text"]],
              deliveryEnabled
                ? [t["about.card4_delivery_title"], t["about.card4_delivery_text"]]
                : [t["about.card4_pickup_title"], t["about.card4_pickup_text"]],
            ].map(([title, body], i) => (
              <div key={title} className="border-t-2 border-brand-brown pt-5 dark:border-orange-200/30">
                <p className="font-display text-sm font-bold tracking-[0.2em] text-brand-orange">{String(i + 1).padStart(2, "0")}</p>
                <p className="mt-2 font-display text-xl font-bold text-brand-brown dark:text-orange-50">{title}</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-600 dark:text-stone-300">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MENU PREVIEW */}
      <section id="menu" className="bg-brand-cream px-4 dark:bg-[#15100c] py-12 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10">
            <p className="font-bold tracking-widest text-brand-orange text-xs mb-2 uppercase">{t["menu.eyebrow"]}</p>
            <h2 className="font-display text-3xl font-bold text-brand-brown dark:text-orange-50 md:text-4xl">{t["menu.title"]}</h2>
          </div>
          <div className={cn("grid gap-6 sm:grid-cols-2", count >= 4 && "lg:grid-cols-4",
            count === 3 && "mx-auto max-w-5xl lg:grid-cols-3", count <= 2 && "mx-auto max-w-2xl")}>
            {(bestsellers ?? []).map((p) => (
              <div key={p.id} className="card group flex flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="relative h-52 overflow-hidden bg-stone-100 dark:bg-stone-800">
                  {p.image_url ? (
                    <Image src={p.image_url} alt={p.name} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-110" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-brand-cream text-stone-300 dark:bg-stone-800 dark:text-stone-600" aria-hidden><UtensilsCrossed size={40} /></div>
                  )}
                  <span className={`absolute top-3 right-3 badge shadow-sm ${p.is_veg ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {p.is_veg ? L.veg : L.nonVeg}
                  </span>
                  {promoActive && priceOf(p) !== Number(p.price) && (
                    <span className="absolute top-3 left-3 badge shadow-sm bg-brand-green text-white">{L.openingOffer}</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="font-display font-bold text-brand-brown dark:text-orange-50">{p.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-stone-500 dark:text-stone-400 leading-relaxed">{p.description}</p>
                  <p className="mb-3 mt-2 flex items-center gap-2 text-xs font-bold text-stone-500 dark:text-stone-400" aria-label={`${L.spiceAria}: ${L.spice[p.spice_level] ?? L.spice[0]}`}>
                    <span aria-hidden className="flex gap-0.5">
                      {[0, 1, 2, 3].map((n) => (
                        <span key={n} className={cn("h-1.5 w-3.5 rounded-full",
                          n <= (p.spice_level ?? 0) ? SPICE_COLOUR[Math.min(3, p.spice_level ?? 0)] : "bg-stone-200 dark:bg-stone-700")} />
                      ))}
                    </span>
                    {L.spice[p.spice_level] ?? L.spice[0]}
                  </p>
                  <div className="mt-auto flex items-center justify-between border-t border-orange-50 pt-3 dark:border-stone-800">
                    {promoActive && priceOf(p) !== Number(p.price) ? (
                      <p className="font-display text-xl font-bold text-brand-orange flex items-center gap-1.5">
                        {npr(priceOf(p))}
                        <span className="text-xs font-normal text-stone-400 line-through">{npr(Number(p.price))}</span>
                      </p>
                    ) : (
                      <p className="font-display text-xl font-bold text-brand-orange">{npr(Number(p.price))}</p>
                    )}
                    <AddToCartButton product={{ product_id: p.id, name: p.name, price: priceOf(p) }} lang={lang} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link href="/order" className="btn-primary text-lg px-10 py-3.5 shadow-lg shadow-orange-500/20">
              {t["menu.button"]}
            </Link>
          </div>
        </div>
      </section>

      {/* HOW TO ORDER — the video (Admin → Website text → How-to-order video, our own player) beside the three steps */}
      <section id="order" className="bg-brand-dark px-4 py-12 md:py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="font-bold tracking-widest text-brand-orange text-xs mb-2 uppercase">{t["order.eyebrow"]}</p>
            <h2 className="font-display text-3xl font-bold md:text-4xl">{t["order.title"]}</h2>
            <p className="mt-3 whitespace-pre-line text-orange-100/70 max-w-lg mx-auto">{t["order.text"]}</p>
          </div>
          <div className={cn("mt-12", video && "grid items-center gap-10 lg:grid-cols-[320px_1fr] lg:gap-16")}>
            {video && (
              <figure className="mx-auto w-full max-w-[300px] lg:max-w-none">
                <HowToVideo {...video} />
                <figcaption className="mt-3 text-center text-sm font-bold text-orange-100/80">{t["order.video_title"]}</figcaption>
              </figure>
            )}
            <div>
              <div className={cn("grid", video ? "gap-4" : "gap-8 sm:grid-cols-3")}>
                {[
                  ["1", t["order.step1_title"], t["order.step1_text"]],
                  deliveryEnabled
                    ? ["2", t["order.step2_delivery_title"], t["order.step2_delivery_text"]]
                    : ["2", t["order.step2_pickup_title"], t["order.step2_pickup_text"]],
                  ["3", t["order.step3_title"], t["order.step3_text"]],
                ].map(([n, title, body]) => (
                  <div key={n} className={cn("rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm",
                    video ? "flex items-start gap-5 p-5 text-left sm:p-6" : "p-8 text-center")}>
                    <p className={cn("font-display font-bold text-brand-orange", video ? "text-4xl leading-none" : "text-5xl")}>{n}</p>
                    <div>
                      <p className={cn("font-display text-xl font-bold", !video && "mt-3")}>{title}</p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-orange-100/75">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className={cn("mt-10 flex flex-wrap gap-4", video ? "justify-center lg:justify-start" : "justify-center")}>
                <Link href="/order" className="btn-primary text-lg px-8 py-3.5">{t["order.button_pickup"]}</Link>
                {deliveryEnabled && (
                  <Link href="/order" className="btn-outline text-lg px-8 py-3.5">{t["order.button_delivery"]}</Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white px-4 dark:bg-stone-950 py-12 md:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-8">
            <p className="font-bold tracking-widest text-brand-orange text-xs mb-2 uppercase">{t["faq.eyebrow"]}</p>
            <h2 className="font-display text-3xl font-bold text-brand-brown dark:text-orange-50 md:text-4xl">{t["faq.title"]}</h2>
          </div>
          <Faq faqs={faqs} />
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="bg-brand-cream px-4 dark:bg-[#15100c] py-12 md:py-20">
        <div className="mx-auto max-w-2xl">
          <div className="text-center">
            <p className="font-bold tracking-widest text-brand-orange text-xs mb-2 uppercase">{t["contact.eyebrow"]}</p>
            <h2 className="font-display text-3xl font-bold text-brand-brown dark:text-orange-50 md:text-4xl">{t["contact.title"]}</h2>
          </div>
          <div className="mt-6 card p-5 sm:p-7">
            <ContactForm lang={lang} />
          </div>
          <div className="mt-4 card border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-5 dark:border-stone-800 dark:from-stone-900 dark:to-stone-900">
            <p className="whitespace-pre-line text-sm text-stone-700 dark:text-stone-300">
              <b>{t["contact.franchise_title"]}</b> {t["contact.franchise_text"]}
            </p>
          </div>
          <WhatsAppFloat href={whatsappHref(t)} label={L.chatWhatsapp} />
        </div>
      </section>

      {/* FIND US — the map at the bottom of the page */}
      <section id="location" className="bg-white px-4 dark:bg-stone-950 py-12 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-5 md:items-center md:gap-12">
          <div className="md:col-span-2">
            <p className="font-bold tracking-widest text-brand-orange text-xs mb-2 uppercase">{t["location.eyebrow"]}</p>
            <h2 className="font-display text-3xl font-bold text-brand-brown dark:text-orange-50 md:text-4xl">{t["location.title"]}</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-stone-600 dark:text-stone-300">{t["location.text"]}</p>
            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3">
                <MapPin size={20} className="mt-0.5 shrink-0 text-brand-orange" aria-hidden />
                <div>
                  <p className="font-bold text-brand-brown dark:text-orange-50">{t["contact.kitchen"]}</p>
                  <p className="text-sm text-stone-600 dark:text-stone-300">{t["contact.address"]}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock size={20} className="mt-0.5 shrink-0 text-brand-orange" aria-hidden />
                <div>
                  <p className="font-bold text-brand-brown dark:text-orange-50">{t["contact.hours_title"]}</p>
                  <p className="text-sm text-stone-600 dark:text-stone-300">{hoursLine}</p>
                  <OpenStatus start={hours.start} end={hours.end} lang={lang} className="mt-1.5" />
                </div>
              </div>
              {deliveryEnabled && (
                <div className="flex items-start gap-3">
                  <Bike size={20} className="mt-0.5 shrink-0 text-brand-orange" aria-hidden />
                  <div>
                    <p className="font-bold text-brand-brown dark:text-orange-50">{L.delivery}</p>
                    <p className="text-sm text-stone-600 dark:text-stone-300">{t["contact.delivery"]}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <a href={directions} target="_blank" rel="noopener noreferrer" className="btn-primary shadow-lg shadow-orange-500/20">
                <Navigation size={18} aria-hidden /> {t["location.directions"]}
              </a>
              <a href={whatsappHref(t)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-stone-200 px-6 py-3 font-bold text-brand-brown transition hover:border-[#25D366] hover:text-[#128C7E] dark:border-stone-700 dark:text-orange-50 dark:hover:text-[#25D366]">
                <WhatsAppGlyph size={18} /> WhatsApp
              </a>
            </div>
          </div>
          <div className="md:col-span-3">
            <div className="overflow-hidden rounded-3xl bg-stone-100 shadow-xl shadow-stone-900/10 ring-1 ring-stone-200 dark:bg-stone-900 dark:shadow-black/40 dark:ring-stone-800">
              <iframe
                src={embedUrl(shop)}
                title={L.mapTitle}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                // Dark mode: Google's map turned into a night map (inverted, colours turned back).
                className="block h-[320px] w-full dark:[filter:invert(90%)_hue-rotate(180deg)_brightness(95%)_contrast(90%)] md:h-[440px]"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
