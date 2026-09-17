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
import { SprayCan, Salad, Bike, Store, Zap, Flame, MapPin, Clock, UtensilsCrossed, MessageCircle } from "lucide-react";

export const revalidate = 300;

export const metadata: Metadata = {
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const supabase = createClient();
  const [{ data: bestsellers }, { data: menuItems }, { data: announcement }, { data: settings }] = await Promise.all([
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
    supabase.from("app_settings").select("delivery_enabled").eq("id", 1).single(),
  ]);
  const deliveryEnabled = settings?.delivery_enabled ?? false;

  return (
    <>
      <StructuredData faqs={FAQS} menu={(menuItems ?? []).map((m) => ({ name: m.name, description: m.description, price: Number(m.price) }))} />
      
      {/* HERO */}
      <section id="home" className="relative flex min-h-[85vh] flex-col items-center justify-center bg-brand-cream px-4 text-center overflow-hidden">
        <div className="absolute top-0 right-0 h-96 w-96 -translate-y-1/4 translate-x-1/4 rounded-full bg-yellow-100/60 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 translate-y-1/4 -translate-x-1/4 rounded-full bg-orange-100/60 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-amber-50/40 blur-3xl" />
        
        <div className="absolute top-0 w-full bg-brand-dark py-2.5 text-sm font-bold text-amber-100">
          {announcement?.message ?? (deliveryEnabled ? "Now open — order online for pickup or home delivery" : "Now open — order online for pickup")}
        </div>
        
        <div className="relative z-10 mt-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-xs font-bold text-brand-brown shadow-sm backdrop-blur mb-6">
            <span className="inline-block h-2 w-2 rounded-full bg-brand-green animate-pulse" />
            Serving Banepa, Kavrepalanchok
          </div>
          <h1 className="font-display text-5xl font-extrabold text-brand-brown md:text-7xl max-w-3xl mx-auto leading-tight">
            Hygienic Street Food,
            <span className="brand-gradient-text"> Bold Flavour</span>
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-stone-600 text-lg leading-relaxed">
            Chatpate in 4 signature varieties, momo &amp; ice-cold drinks —
            prepared in our clean kitchen with fresh ingredients, delivered hot to your door.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href="/order" className="btn-primary text-lg px-8 py-3.5 rounded-full shadow-lg shadow-orange-500/30">
              Order Now →
            </Link>
            <a href="#menu" className="text-lg px-8 py-3.5 rounded-full bg-white border-2 border-brand-orange text-brand-orange font-bold transition hover:bg-orange-50 shadow-sm">
              See Menu
            </a>
          </div>
          {/* Trust badges */}
          <div className="mt-10 flex flex-wrap justify-center gap-6 text-xs font-bold text-stone-500">
            {[
              [SprayCan, "Kitchen Hygiene Certified"],
              [Salad, "Fresh Ingredients Daily"],
              deliveryEnabled ? [Bike, "Nrs 20 Home Delivery"] : [Store, "Order Ahead for Pickup"],
              [Zap, "Ready in 10–15 mins"],
            ].map(([Icon, text]: any) => (
              <span key={text} className="flex items-center gap-1.5 bg-white/60 rounded-full px-3 py-1.5 backdrop-blur-sm">
                <Icon size={14} /> {text}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* WHY THELAWALAA */}
      <section id="about" className="bg-white px-4 py-12 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <p className="font-bold tracking-widest text-brand-orange text-xs mb-2 uppercase">Why Choose Us</p>
            <h2 className="font-display text-4xl font-bold text-brand-brown">Where Hygiene Meets Flavour</h2>
            <p className="mt-4 max-w-2xl mx-auto text-stone-600 leading-relaxed">
              Thelawalaa brings the excitement of street food into a modern, hygienic format. 
              Every dish is prepared fresh in our certified kitchen with premium ingredients — 
              no shortcuts, no compromises. Just bold taste you can trust.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [SprayCan, "Certified Hygiene", "Prepared in a clean, sanitized kitchen with food-grade packaging for every order."],
              [Flame, "4 Chatpate Varieties", "Classic, Gilo, Mint & Spicy Ramen — each with our signature house masala."],
              [Salad, "Fresh Ingredients", "Locally sourced vegetables, premium spices, and quality proteins — no preservatives."],
              deliveryEnabled
                ? [Bike, "Quick Delivery", "Hot to your door within 5km of Godam Chowk for just Nrs 20 — or pickup for free."]
                : [Store, "Easy Pickup", "Order ahead and collect it hot from our Godam Chowk kitchen — no waiting in line."],
            ].map(([Icon, title, body]: any) => (
              <div key={title} className="card p-6 text-center hover:shadow-xl transition-shadow duration-300 border border-orange-50">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-brand-orange"><Icon size={24} /></div>
                <p className="font-display text-lg font-bold text-brand-brown">{title}</p>
                <p className="mt-2 text-sm text-stone-600 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MENU PREVIEW */}
      <section id="menu" className="bg-brand-cream px-4 py-12 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10">
            <p className="font-bold tracking-widest text-brand-orange text-xs mb-2 uppercase">Our Bestsellers</p>
            <h2 className="font-display text-3xl font-extrabold text-brand-brown md:text-4xl">Most Loved by Our Customers</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {(bestsellers ?? []).map((p) => (
              <div key={p.id} className="card overflow-hidden transition hover:shadow-xl hover:-translate-y-1 duration-300 group">
                <div className="relative h-52 overflow-hidden bg-stone-100">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-110" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-brand-cream text-stone-300" aria-hidden><UtensilsCrossed size={40} /></div>
                  )}
                  <span className={`absolute top-3 right-3 badge shadow-sm ${p.is_veg ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {p.is_veg ? "Veg" : "Non-Veg"}
                  </span>
                </div>
                <div className="p-5">
                  <p className="font-display font-bold text-brand-brown">{p.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-stone-500 leading-relaxed">{p.description}</p>
                  <p className="mt-1 text-sm text-brand-red" aria-label={`Spice level ${p.spice_level} of 3`}>
                    {"🌶".repeat(p.spice_level) || "Mild"}
                  </p>
                  <div className="mt-3 flex items-center justify-between border-t border-orange-50 pt-3">
                    <p className="font-display text-xl font-bold text-brand-orange">{npr(Number(p.price))}</p>
                    <AddToCartButton product={{ product_id: p.id, name: p.name, price: Number(p.price) }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link href="/order" className="btn-primary text-lg px-10 py-3.5 shadow-lg shadow-orange-500/20">
              View Full Menu & Order →
            </Link>
          </div>
        </div>
      </section>

      {/* HOW TO ORDER */}
      <section id="order" className="bg-brand-dark px-4 py-12 md:py-20 text-white">
        <div className="mx-auto max-w-6xl text-center">
          <p className="font-bold tracking-widest text-brand-orange text-xs mb-2 uppercase">Simple Process</p>
          <h2 className="font-display text-4xl font-bold">How to Order</h2>
          <p className="mt-3 text-orange-100/70 max-w-lg mx-auto">Fresh food, ready in minutes. No app download required.</p>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              ["1", "Browse & Add", "Pick your favourites from our menu and add them to your cart."],
              deliveryEnabled
                ? ["2", "Choose Pickup or Delivery", "Collect from our Godam Chowk kitchen or get it delivered within 5km for Nrs 20."]
                : ["2", "Choose Pickup", "Collect it hot and fresh from our Godam Chowk kitchen."],
              ["3", "Pay on Arrival", "Pay cash or scan our eSewa/FonePay QR when your order arrives. Simple."],
            ].map(([n, title, body]) => (
              <div key={n} className="rounded-2xl bg-white/5 p-8 backdrop-blur-sm border border-white/10">
                <p className="font-display text-5xl font-bold text-brand-orange">{n}</p>
                <p className="mt-3 font-display text-xl font-bold">{title}</p>
                <p className="mt-2 text-sm text-orange-100/60 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <Link href="/order" className="btn-primary text-lg px-8 py-3.5">Order for Pickup</Link>
            {deliveryEnabled && (
              <Link href="/order" className="btn-outline text-lg px-8 py-3.5">Order for Delivery</Link>
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white px-4 py-12 md:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-8">
            <p className="font-bold tracking-widest text-brand-orange text-xs mb-2 uppercase">Got Questions?</p>
            <h2 className="font-display text-4xl font-bold text-brand-brown">Frequently Asked Questions</h2>
          </div>
          <Faq />
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="bg-brand-cream px-4 py-12 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2">
          <div>
            <p className="font-bold tracking-widest text-brand-orange text-xs mb-2 uppercase">Get In Touch</p>
            <h2 className="font-display text-4xl font-bold text-brand-brown">Say Hello</h2>
            <ContactForm />
          </div>
          <div>
            <h3 className="font-display text-xl font-bold text-brand-brown">Visit or Order From</h3>
            <div className="mt-4 card p-5 space-y-3">
              <div className="flex items-start gap-3">
                <MapPin size={20} className="mt-0.5 shrink-0 text-brand-orange" />
                <div>
                  <p className="font-bold text-brand-brown">Thelawalaa Kitchen</p>
                  <p className="text-sm text-stone-600">Godam Chowk, Banepa, Kavrepalanchok</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock size={20} className="mt-0.5 shrink-0 text-brand-orange" />
                <div>
                  <p className="font-bold text-brand-brown">Operating Hours</p>
                  <p className="text-sm text-stone-600">10:00 AM – 8:00 PM · Every Day</p>
                </div>
              </div>
              {deliveryEnabled && (
                <div className="flex items-start gap-3">
                  <Bike size={20} className="mt-0.5 shrink-0 text-brand-orange" />
                  <div>
                    <p className="font-bold text-brand-brown">Delivery</p>
                    <p className="text-sm text-stone-600">Within 5km · Flat Nrs 20 · Free above Rs 500</p>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 card p-5 bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100">
              <p className="text-sm text-stone-700">
                <b>Franchise enquiries welcome.</b> We&apos;re building Thelawalaa into a
                trusted street-food brand across Nepal — reach out to partner with us.
              </p>
            </div>
            <a
              href="https://wa.me/9779801011111"
              target="_blank"
              rel="noopener noreferrer"
              className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-green text-white shadow-lg shadow-green-500/30 transition hover:scale-110"
              aria-label="Chat on WhatsApp"
            >
              <MessageCircle size={26} />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
