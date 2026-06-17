import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { npr } from "@/lib/utils";
import { SITE } from "@/lib/seo";
import { FAQS } from "@/lib/faqs";
import ContactForm from "@/components/contact-form";
import Faq from "@/components/faq";
import AddToCartButton from "@/components/add-to-cart-button";
import StructuredData from "@/components/structured-data";

export const revalidate = 300;

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const supabase = createClient();
  const [{ data: bestsellers }, { data: menuItems }, { data: announcement }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, description, price, spice_level, is_veg, image_url")
      .eq("is_bestseller", true)
      .order("sort_order")
      .limit(4),
    supabase
      .from("products")
      .select("name, description, price")
      .eq("is_available", true)
      .order("sort_order")
      .limit(50),
    supabase
      .from("announcements")
      .select("message, link_url")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <>
      <StructuredData faqs={FAQS} menu={(menuItems ?? []).map((m) => ({ name: m.name, description: m.description, price: Number(m.price) }))} />
      {/* HERO */}
      <section id="home" className="relative flex min-h-[80vh] flex-col items-center justify-center bg-brand-cream px-4 text-center overflow-hidden">
        {/* Background blobs matching the screenshot */}
        <div className="absolute top-0 right-0 h-96 w-96 -translate-y-1/4 translate-x-1/4 rounded-full bg-yellow-100/60 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 translate-y-1/4 -translate-x-1/4 rounded-full bg-orange-100/60 blur-3xl" />
        
        <div className="absolute top-0 w-full bg-brand-yellow py-2 text-sm font-extrabold text-brand-dark">
          {announcement?.message ?? "🛵 Free delivery on orders above Rs 500"}
        </div>
        
        <div className="relative z-10 mt-12">
          <p className="font-bold tracking-widest text-brand-orange text-xs mb-3">KATHMANDU • PATAN • BHAKTAPUR</p>
          <h1 className="font-display text-5xl font-extrabold text-brand-brown md:text-7xl max-w-2xl mx-auto leading-tight">
            Street food that<br/>hits different <span aria-hidden>🥘</span>
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-stone-600">
            Chatpate, pani puri, momo chaat and more — made fresh on the tawa, delivered hot to your tole.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/order" className="btn-primary text-lg px-8 py-3 rounded-full shadow-lg shadow-orange-500/30">Start an order</Link>
            <a href="#menu" className="btn-outline text-lg px-8 py-3 rounded-full bg-white border-2 border-brand-orange text-brand-orange">See menu</a>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="bg-brand-cream px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-4xl font-bold text-brand-brown">The Story Behind the Thela</h2>
          <p className="mt-4 max-w-2xl text-stone-700">
            Thelawalaa starts in Butwal with one promise: the most flavourful street food in town,
            made with real hygiene and real variety. From our Manigram kitchen we serve chatpate in
            five varieties — Spicy, Chicken, Spicy Ramen, Mint and Sweet Chilly — alongside panipuri,
            fulki and momo, freshly made and delivered hot to your door. This is just the beginning:
            our vision is to grow Thelawalaa into a street-food brand you&apos;ll find far beyond Butwal.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["🧼", "Hygiene First", "Made fresh in a clean kitchen and sealed for safe delivery."],
              ["🌶", "Bold Flavour", "House masalas and signature achar — taste you'll come back for."],
              ["🍽", "Real Variety", "Five chatpate varieties plus panipuri, fulki and momo."],
              ["🛵", "Nrs 20 Delivery", "Hot to your door within 5km of our Manigram store."],
            ].map(([icon, title, body]) => (
              <div key={title} className="card p-6">
                <p className="text-3xl">{icon}</p>
                <p className="mt-2 font-display text-xl font-bold">{title}</p>
                <p className="mt-1 text-sm text-stone-600">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-center font-display text-lg font-bold text-brand-orange">
            Freshly Made · Hygienic · Flavourful · Now Delivering in Butwal–Manigram
          </p>
        </div>
      </section>

      {/* MENU PREVIEW */}
      <section id="menu" className="bg-white px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <p className="font-bold tracking-widest text-brand-orange text-xs mb-2 uppercase">Bestsellers</p>
          <h2 className="font-display text-3xl font-extrabold text-brand-brown md:text-4xl">From the thela 🔥</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {(bestsellers ?? []).map((p) => (
              <div key={p.id} className="card overflow-hidden p-5 transition hover:scale-105">
                <div className="flex h-28 items-center justify-center rounded-xl bg-brand-cream text-5xl" aria-hidden>
                  🥣
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <p className="font-bold">{p.name}</p>
                  <span className={`badge ${p.is_veg ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {p.is_veg ? "veg" : "non-veg"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-stone-600">{p.description}</p>
                <p className="mt-1 text-sm text-brand-red" aria-label={`Spice level ${p.spice_level} of 3`}>
                  {"🌶".repeat(p.spice_level) || "mild"}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="font-display text-lg font-bold text-brand-orange">{npr(Number(p.price))}</p>
                  <AddToCartButton product={{ product_id: p.id, name: p.name, price: Number(p.price) }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/order" className="btn-primary">View Full Menu →</Link>
          </div>
        </div>
      </section>

      {/* HOW TO ORDER */}
      <section id="order" className="bg-brand-dark px-4 py-20 text-white">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="font-display text-4xl font-bold">How to Order</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              ["1", "Choose Items", "Pick your favourites from the menu."],
              ["2", "Place Order", "Pay cash or scan our eSewa / FonePay QR on arrival."],
              ["3", "Pickup or Delivery", "Collect at Manigram, or home delivery within 5km for Nrs 20."],
            ].map(([n, title, body]) => (
              <div key={n}>
                <p className="font-display text-6xl font-bold text-brand-orange">{n}</p>
                <p className="mt-2 font-display text-xl font-bold">{title}</p>
                <p className="mt-1 text-sm text-orange-100/70">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/order" className="btn-primary">Order for Pickup</Link>
            <Link href="/order" className="btn-outline">Order for Delivery</Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-brand-cream px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-4xl font-bold text-brand-brown">Questions, Answered</h2>
          <Faq />
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="bg-white px-4 py-20">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-4xl font-bold text-brand-brown">Say Hello</h2>
            <ContactForm />
          </div>
          <div>
            <h3 className="font-display text-xl font-bold">Visit or Order From</h3>
            <ul className="mt-4 space-y-4 text-sm text-stone-700">
              <li><b>Manigram Store</b> — Manigram, Tilottama, Butwal, Rupandehi · +977 9801 011111</li>
              <li className="text-stone-500">Home delivery within 5km · flat Nrs 20 · pickup also available</li>
            </ul>
            <p className="mt-4 rounded-xl bg-brand-cream p-4 text-sm text-stone-600">
              🚀 <b>Franchise enquiries welcome.</b> We&apos;re building Thelawalaa into a national
              street-food brand — reach out through the form to partner with us.
            </p>
            <a
              href="https://wa.me/9779801011111"
              target="_blank"
              rel="noopener noreferrer"
              className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-green text-2xl text-white shadow-warm transition hover:scale-110"
              aria-label="Chat on WhatsApp"
            >
              💬
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
