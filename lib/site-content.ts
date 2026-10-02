import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Website text the admin edits in Admin → Website text (site_content,
// migration 026). Every field has a built-in default — the site as written —
// so the table only holds what has been changed, and clearing a field puts
// the default back. Plain text only (no HTML); line breaks are kept.
//
// Adding text to the site? Add a field here and read it with getSiteText().

type Field = { key: string; label: string; default: string; max: number; multiline?: boolean; hint?: string };
type Section = { id: string; title: string; where: string; fields: Field[] };

// Generic so each field keeps its exact key — t["hero.title"] is checked at build time.
const f = <K extends string>(key: K, label: string, def: string, max = 80, extra: Omit<Partial<Field>, "key"> = {}) =>
  ({ key, label, default: def, max, ...extra });

export const SITE_TEXT_SECTIONS = [
  {
    id: "hero", title: "Top of the homepage", where: "/#home",
    fields: [
      f("hero.eyebrow", "Small line above the headline", "Godam Chowk · Banepa", 60),
      f("hero.title", "Headline", "Hygienic Street Food,", 60),
      f("hero.highlight", "Coloured end of the headline", "Bold Flavour", 40),
      f("hero.text", "Text under the headline", "Chatpate in 4 signature varieties, momo & ice-cold drinks — prepared in our clean kitchen with fresh ingredients, delivered hot to your door.", 300, { multiline: true }),
      f("hero.button", "Main button", "Order Now →", 30),
      f("hero.button2", "Second button", "See Menu", 30),
      f("hero.badge1", "Badge 1", "Kitchen Hygiene Certified", 40),
      f("hero.badge2", "Badge 2", "Fresh Ingredients Daily", 40),
      f("hero.badge3_delivery", "Badge 3 — when delivery is ON", "Nrs 20 Home Delivery", 40),
      f("hero.badge3_pickup", "Badge 3 — when delivery is OFF", "Order Ahead for Pickup", 40),
      f("hero.badge4", "Badge 4", "Ready in 10–15 mins", 40),
    ],
  },
  {
    id: "about", title: "Why choose us", where: "/#about",
    fields: [
      f("about.eyebrow", "Small heading", "Why Choose Us", 40),
      f("about.title", "Heading", "Where Hygiene Meets Flavour", 80),
      f("about.text", "Paragraph", "Thelawalaa brings the excitement of street food into a modern, hygienic format. Every dish is prepared fresh in our certified kitchen with premium ingredients — no shortcuts, no compromises. Just bold taste you can trust.", 500, { multiline: true }),
      f("about.card1_title", "Card 1 title", "Certified Hygiene", 40),
      f("about.card1_text", "Card 1 text", "Prepared in a clean, sanitized kitchen with food-grade packaging for every order.", 200, { multiline: true }),
      f("about.card2_title", "Card 2 title", "4 Chatpate Varieties", 40),
      f("about.card2_text", "Card 2 text", "Classic, Gilo, Mint & Spicy Ramen — each with our signature house masala.", 200, { multiline: true }),
      f("about.card3_title", "Card 3 title", "Fresh Ingredients", 40),
      f("about.card3_text", "Card 3 text", "Locally sourced vegetables, premium spices, and quality proteins — no preservatives.", 200, { multiline: true }),
      f("about.card4_delivery_title", "Card 4 title — when delivery is ON", "Quick Delivery", 40),
      f("about.card4_delivery_text", "Card 4 text — when delivery is ON", "Hot to your door within 5km of Godam Chowk for just Nrs 20 — or pickup for free.", 200, { multiline: true }),
      f("about.card4_pickup_title", "Card 4 title — when delivery is OFF", "Easy Pickup", 40),
      f("about.card4_pickup_text", "Card 4 text — when delivery is OFF", "Order ahead and collect it hot from our Godam Chowk kitchen — no waiting in line.", 200, { multiline: true }),
    ],
  },
  {
    id: "menu", title: "Bestsellers", where: "/#menu",
    fields: [
      f("menu.eyebrow", "Small heading", "Our Bestsellers", 40),
      f("menu.title", "Heading", "Most Loved by Our Customers", 80),
      f("menu.button", "Button under the dishes", "View Full Menu & Order →", 40),
    ],
  },
  {
    id: "order", title: "How to order", where: "/#order",
    fields: [
      f("order.eyebrow", "Small heading", "Simple Process", 40),
      f("order.title", "Heading", "How to Order", 60),
      f("order.text", "Text under the heading", "Fresh food, ready in minutes. No app download required.", 200, { multiline: true }),
      f("order.step1_title", "Step 1 title", "Browse & Add", 40),
      f("order.step1_text", "Step 1 text", "Pick your favourites from our menu and add them to your cart.", 200, { multiline: true }),
      f("order.step2_delivery_title", "Step 2 title — when delivery is ON", "Choose Pickup or Delivery", 40),
      f("order.step2_delivery_text", "Step 2 text — when delivery is ON", "Collect from our Godam Chowk kitchen or get it delivered within 5km for Nrs 20.", 200, { multiline: true }),
      f("order.step2_pickup_title", "Step 2 title — when delivery is OFF", "Choose Pickup", 40),
      f("order.step2_pickup_text", "Step 2 text — when delivery is OFF", "Collect it hot and fresh from our Godam Chowk kitchen.", 200, { multiline: true }),
      f("order.step3_title", "Step 3 title", "Pay on Arrival", 40),
      f("order.step3_text", "Step 3 text", "Pay cash or scan our eSewa/FonePay QR when your order arrives. Simple.", 200, { multiline: true }),
      f("order.button_pickup", "Pickup button", "Order for Pickup", 30),
      f("order.button_delivery", "Delivery button (only when delivery is ON)", "Order for Delivery", 30),
    ],
  },
  {
    id: "faq", title: "Questions (FAQ)", where: "/#faq",
    fields: [
      f("faq.eyebrow", "Small heading", "Got Questions?", 40),
      f("faq.title", "Heading", "Frequently Asked Questions", 60, { hint: "The questions themselves are in Admin → FAQs." }),
    ],
  },
  {
    id: "contact", title: "Contact & opening hours", where: "/#contact",
    fields: [
      f("contact.eyebrow", "Small heading", "Get In Touch", 40),
      f("contact.title", "Heading", "Say Hello", 60),
      f("contact.place_title", "Heading beside the form", "Visit or Order From", 60),
      f("contact.kitchen", "Shop name", "Thelawalaa Kitchen", 60),
      f("contact.address", "Address", "Godam Chowk, Banepa, Kavrepalanchok", 120),
      f("contact.hours_title", "Opening hours heading", "Operating Hours", 40),
      f("contact.hours", "Opening hours", "10:00 AM – 8:00 PM · Every Day", 80),
      f("contact.delivery", "Delivery line (only when delivery is ON)", "Within 5km · Flat Nrs 20 · Free above Rs 500", 100),
      f("contact.franchise_title", "Franchise box — bold start", "Franchise enquiries welcome.", 60),
      f("contact.franchise_text", "Franchise box — rest", "We're building Thelawalaa into a trusted street-food brand across Nepal — reach out to partner with us.", 300, { multiline: true }),
      f("contact.whatsapp", "WhatsApp number (with 977)", "9779801011111", 15,
        { hint: "Digits only, starting 977 — used by every WhatsApp button on the site." }),
    ],
  },
  {
    id: "footer", title: "Footer", where: "/#home",
    fields: [
      f("footer.tagline", "Line under the logo", "Crispy, spicy, straight from the thela — now at your door.", 120),
    ],
  },
] as const satisfies readonly Section[];

type Sections = typeof SITE_TEXT_SECTIONS;
export type SiteTextKey = Sections[number]["fields"][number]["key"];
export type SiteText = Record<SiteTextKey, string>;

export const SITE_TEXT_FIELDS: readonly Field[] = SITE_TEXT_SECTIONS.flatMap((s): readonly Field[] => s.fields);
export const SITE_TEXT_DEFAULTS = Object.fromEntries(SITE_TEXT_FIELDS.map((x) => [x.key, x.default])) as SiteText;

/** The website text as it should show right now: saved changes over the defaults. One read per request. */
export const getSiteText = cache(async (): Promise<SiteText> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("site_content").select("key, value");
    const saved = Object.fromEntries((data ?? []).filter((r) => r.key in SITE_TEXT_DEFAULTS).map((r) => [r.key, r.value]));
    return { ...SITE_TEXT_DEFAULTS, ...saved };
  } catch {
    return SITE_TEXT_DEFAULTS; // the site never breaks over its wording
  }
});

/** wa.me link for the editable WhatsApp number. */
export const whatsappHref = (t: Pick<SiteText, "contact.whatsapp">, text?: string) =>
  `https://wa.me/${t["contact.whatsapp"].replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
