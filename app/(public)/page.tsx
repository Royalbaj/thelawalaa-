import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { npr } from "@/lib/utils";
import { SITE } from "@/lib/seo";
import { applyOpeningPromoPrice, isOpeningPromoActive } from "@/lib/promo";
import ContactForm from "@/components/contact-form";
import heroImage from "@/public/images/hero/thelawalaa-chatpate-momo.webp";
import { getSiteText, whatsappHref } from "@/lib/site-content";
import Faq from "@/components/faq";
import AddToCartButton from "@/components/add-to-cart-button";
import StructuredData from "@/components/structured-data";
import HeroSteam from "@/components/hero-steam";
import { WhatsAppGlyph } from "@/components/icons/brand-glyphs";

const SPICE = ["Mild", "Medium", "Hot", "Extra hot"];
import { Bike, MapPin, Clock, UtensilsCrossed } from "lucide-react";

export const revalidate = 300;

export const metadata: Metadata = {
  // absolute: the layout's "%s · Thelawalaa" template would repeat the name.
  title: { absolute: `${SITE.name} — ${SITE.tagline}` },
  description: SITE.description,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const supabase = await createClient();
  const [{ data: bestsellers }, { data: menuItems }, { data: announcement }, { data: settings }, { data: faqRows }] = await Promise.all([
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
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("app_settings").select("delivery_enabled, opening_promo_enabled, opening_promo_momo_price, opening_promo_starts_at, opening_promo_ends_at").eq("id", 1).single(),
    supabase.from("faqs").select("question, answer").eq("is_active", true).order("sort_order"),
  ]);
  const faqs = (faqRows ?? []).map((f) => ({ q: f.question, a: f.answer }));
  // Every bit of wording below is editable in Admin → Website text (lib/site-content.ts).
  const t = await getSiteText();
  const deliveryEnabled = settings?.delivery_enabled ?? false;
  const promoActive = isOpeningPromoActive(settings);
  const priceOf = (p: { price: number; categories?: { name: string } | { name: string }[] | null }) => {
    const catName = Array.isArray(p.categories) ? p.categories[0]?.name : p.categories?.name;
    return applyOpeningPromoPrice(Number(p.price), catName ?? null, settings);
  };

  return (
    <>
      <StructuredData faqs={faqs} menu={(menuItems ?? []).map((m) => ({ name: m.name, description: m.description, price: Number(m.price) }))} />
      
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
        <div className="relative z-20 border-b border-white/10 bg-black/40 py-2.5 text-center text-sm font-bold text-amber-100">
          {announcement?.message ?? (deliveryEnabled ? "Now open — order online for pickup or home delivery" : "Now open — order online for pickup")}
        </div>

        <div className="relative mx-auto max-w-7xl lg:flex lg:min-h-[620px] lg:items-center lg:static">
          {/* Photo. Phones/tablets: full width on top. Wide screens: whole 3:2 shot
              on the right, reaching the screen edge, faded on its other sides. */}
          <div className="relative lg:absolute lg:inset-y-0 lg:right-0 lg:flex lg:w-[60%] lg:max-w-[1100px] lg:items-center">
            {/* hero-photo-fade (globals.css) fades the photo itself out at its edges,
                so the background shows through — no seam, whatever the colours. */}
            <div className="hero-photo-fade relative aspect-[3/2] w-full">
              <Image
                src={heroImage}
                alt="Thelawalaa chatpate and steaming momo in branded takeaway boxes"
                fill
                priority
                placeholder="blur"
                sizes="(min-width: 1834px) 1100px, (min-width: 1024px) 60vw, 100vw"
                className="object-cover"
              />
              {/* Live steam off the momo — placed in the photo's own coordinates (3:2),
                  from the momo tops up to the top edge. */}
              <HeroSteam className="pointer-events-none absolute left-[50%] top-0 h-[52%] w-[46%]" />
            </div>
          </div>

          {/* Warm glow over everything (text side and photo alike, so no seam), like the photo's own light */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_15%_55%,rgba(235,104,52,0.14),transparent_70%)]" />

          {/* Words */}
          <div className="relative z-10 -mt-10 px-4 pb-28 text-center sm:-mt-16 lg:mt-0 lg:w-[44%] lg:pt-20 lg:pb-32 lg:pl-8 lg:text-left xl:w-[46%] xl:pl-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-orange">{t["hero.eyebrow"]}</p>
            <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight text-amber-50 sm:text-5xl md:text-6xl xl:text-7xl">
              {t["hero.title"]}
              <span className="brand-gradient-text"> {t["hero.highlight"]}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-lg whitespace-pre-line text-lg leading-relaxed text-amber-100/75 lg:mx-0">
              {t["hero.text"]}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4 lg:justify-start">
              <Link href="/order" className="btn-primary px-8 py-3.5 text-lg shadow-lg shadow-orange-600/40">
                {t["hero.button"]}
              </Link>
              <a href="#menu" className="rounded-full border-2 border-amber-100/40 px-8 py-3.5 text-lg font-bold text-amber-50 transition hover:border-amber-100/70 hover:bg-white/10">
                {t["hero.button2"]}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip: a white card straddling the hero's straight bottom edge (top
          3.5rem sits over the dark hero, the rest over the white section below). */}
      <div className="relative z-10 -mt-14 bg-[linear-gradient(to_bottom,transparent_3.5rem,#fff_3.5rem)] px-4">
        <ul className="mx-auto grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-2xl bg-stone-100 shadow-xl shadow-stone-900/10 ring-1 ring-stone-200/70 md:grid-cols-4">
          {[t["hero.badge1"], t["hero.badge2"], deliveryEnabled ? t["hero.badge3_delivery"] : t["hero.badge3_pickup"], t["hero.badge4"]].map((text) => (
            <li key={text} className="bg-white px-5 py-5 sm:px-6">
              <span aria-hidden className="block h-0.5 w-8 rounded-full bg-brand-orange" />
              <span className="mt-3 block text-sm font-bold leading-snug text-brand-brown">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* WHY THELAWALAA */}
      <section id="about" className="bg-white px-4 pb-12 pt-10 md:pb-20 md:pt-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <p className="font-bold tracking-widest text-brand-orange text-xs mb-2 uppercase">{t["about.eyebrow"]}</p>
            <h2 className="font-display text-4xl font-bold text-brand-brown">{t["about.title"]}</h2>
            <p className="mt-4 max-w-2xl mx-auto whitespace-pre-line text-stone-600 leading-relaxed">
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
              <div key={title} className="border-t-2 border-brand-brown pt-5">
                <p className="font-display text-sm font-bold tracking-[0.2em] text-brand-orange">{String(i + 1).padStart(2, "0")}</p>
                <p className="mt-2 font-display text-xl font-bold text-brand-brown">{title}</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-600">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MENU PREVIEW */}
      <section id="menu" className="bg-brand-cream px-4 py-12 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10">
            <p className="font-bold tracking-widest text-brand-orange text-xs mb-2 uppercase">{t["menu.eyebrow"]}</p>
            <h2 className="font-display text-3xl font-extrabold text-brand-brown md:text-4xl">{t["menu.title"]}</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {(bestsellers ?? []).map((p) => (
              <div key={p.id} className="card overflow-hidden transition hover:shadow-xl hover:-translate-y-1 duration-300 group">
                <div className="relative h-52 overflow-hidden bg-stone-100">
                  {p.image_url ? (
                    <Image src={p.image_url} alt={p.name} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-110" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-brand-cream text-stone-300" aria-hidden><UtensilsCrossed size={40} /></div>
                  )}
                  <span className={`absolute top-3 right-3 badge shadow-sm ${p.is_veg ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {p.is_veg ? "Veg" : "Non-Veg"}
                  </span>
                  {promoActive && priceOf(p) !== Number(p.price) && (
                    <span className="absolute top-3 left-3 badge shadow-sm bg-brand-green text-white">Opening offer</span>
                  )}
                </div>
                <div className="p-5">
                  <p className="font-display font-bold text-brand-brown">{p.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-stone-500 leading-relaxed">{p.description}</p>
                  <p className="mt-2 flex items-center gap-2 text-xs font-bold text-stone-500" aria-label={`Spice: ${SPICE[p.spice_level] ?? "Mild"}`}>
                    <span aria-hidden className="flex gap-0.5">
                      {[1, 2, 3].map((n) => <span key={n} className={`h-1.5 w-4 rounded-full ${n <= p.spice_level ? "bg-brand-red" : "bg-stone-200"}`} />)}
                    </span>
                    {SPICE[p.spice_level] ?? "Mild"}
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-orange-50 pt-3">
                    {promoActive && priceOf(p) !== Number(p.price) ? (
                      <p className="font-display text-xl font-bold text-brand-orange flex items-center gap-1.5">
                        {npr(priceOf(p))}
                        <span className="text-xs font-normal text-stone-400 line-through">{npr(Number(p.price))}</span>
                      </p>
                    ) : (
                      <p className="font-display text-xl font-bold text-brand-orange">{npr(Number(p.price))}</p>
                    )}
                    <AddToCartButton product={{ product_id: p.id, name: p.name, price: priceOf(p) }} />
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

      {/* HOW TO ORDER */}
      <section id="order" className="bg-brand-dark px-4 py-12 md:py-20 text-white">
        <div className="mx-auto max-w-6xl text-center">
          <p className="font-bold tracking-widest text-brand-orange text-xs mb-2 uppercase">{t["order.eyebrow"]}</p>
          <h2 className="font-display text-4xl font-bold">{t["order.title"]}</h2>
          <p className="mt-3 whitespace-pre-line text-orange-100/70 max-w-lg mx-auto">{t["order.text"]}</p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              ["1", t["order.step1_title"], t["order.step1_text"]],
              deliveryEnabled
                ? ["2", t["order.step2_delivery_title"], t["order.step2_delivery_text"]]
                : ["2", t["order.step2_pickup_title"], t["order.step2_pickup_text"]],
              ["3", t["order.step3_title"], t["order.step3_text"]],
            ].map(([n, title, body]) => (
              <div key={n} className="rounded-2xl bg-white/5 p-8 backdrop-blur-sm border border-white/10">
                <p className="font-display text-5xl font-bold text-brand-orange">{n}</p>
                <p className="mt-3 font-display text-xl font-bold">{title}</p>
                <p className="mt-2 whitespace-pre-line text-sm text-orange-100/60 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Link href="/order" className="btn-primary text-lg px-8 py-3.5">{t["order.button_pickup"]}</Link>
            {deliveryEnabled && (
              <Link href="/order" className="btn-outline text-lg px-8 py-3.5">{t["order.button_delivery"]}</Link>
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white px-4 py-12 md:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-8">
            <p className="font-bold tracking-widest text-brand-orange text-xs mb-2 uppercase">{t["faq.eyebrow"]}</p>
            <h2 className="font-display text-4xl font-bold text-brand-brown">{t["faq.title"]}</h2>
          </div>
          <Faq faqs={faqs} />
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="bg-brand-cream px-4 py-12 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2">
          <div>
            <p className="font-bold tracking-widest text-brand-orange text-xs mb-2 uppercase">{t["contact.eyebrow"]}</p>
            <h2 className="font-display text-4xl font-bold text-brand-brown">{t["contact.title"]}</h2>
            <ContactForm />
          </div>
          <div>
            <h3 className="font-display text-xl font-bold text-brand-brown">{t["contact.place_title"]}</h3>
            <div className="mt-4 card p-5 space-y-3">
              <div className="flex items-start gap-3">
                <MapPin size={20} className="mt-0.5 shrink-0 text-brand-orange" />
                <div>
                  <p className="font-bold text-brand-brown">{t["contact.kitchen"]}</p>
                  <p className="text-sm text-stone-600">{t["contact.address"]}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock size={20} className="mt-0.5 shrink-0 text-brand-orange" />
                <div>
                  <p className="font-bold text-brand-brown">{t["contact.hours_title"]}</p>
                  <p className="text-sm text-stone-600">{t["contact.hours"]}</p>
                </div>
              </div>
              {deliveryEnabled && (
                <div className="flex items-start gap-3">
                  <Bike size={20} className="mt-0.5 shrink-0 text-brand-orange" />
                  <div>
                    <p className="font-bold text-brand-brown">Delivery</p>
                    <p className="text-sm text-stone-600">{t["contact.delivery"]}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 card p-5 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100">
              <p className="whitespace-pre-line text-sm text-stone-700">
                <b>{t["contact.franchise_title"]}</b> {t["contact.franchise_text"]}
              </p>
            </div>
            <a
              href={whatsappHref(t)}
              target="_blank"
              rel="noopener noreferrer"
              className="fixed bottom-32 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition hover:scale-105 md:bottom-6 md:right-6"
              aria-label="Chat on WhatsApp"
            >
              <WhatsAppGlyph size={28} />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
