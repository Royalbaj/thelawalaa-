import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { SiteLang } from "@/lib/site-lang";

// Website text the admin edits in Admin → Website text (site_content,
// migration 026). Every field has a built-in default — the site as written —
// so the table only holds what has been changed, and clearing a field puts
// the default back. Plain text only (no HTML); line breaks are kept.
//
// Adding text to the site? Add a field here and read it with getSiteText().
//
// Homepage fields also have a Nepali version (`ne`) for the Nepali homepage
// (/ne, lib/site-lang.ts). It is stored under "ne.<key>" and edited in its own
// box beside the English; a field without `ne` shows the same on both pages.

type Field = { key: string; label: string; default: string; max: number; multiline?: boolean; hint?: string; ne?: string; neMax?: number };
type Section = { id: string; title: string; where: string; fields: Field[] };

// Generic so each field keeps its exact key — t["hero.title"] is checked at build time.
// Nepali needs more characters than English for the same words (vowel signs count), hence the larger limit.
const f = <K extends string>(key: K, label: string, def: string, max = 80, extra: Omit<Partial<Field>, "key" | "neMax"> = {}) =>
  ({ key, label, default: def, max, ...extra, ...(extra.ne != null ? { neMax: Math.ceil(max * 1.6) } : {}) });

export const SITE_TEXT_SECTIONS = [
  {
    id: "hero", title: "Top of the homepage", where: "/#home",
    fields: [
      f("hero.eyebrow", "Small line above the headline", "Godam Chowk · Banepa", 60, { ne: "गोदाम चोक · बनेपा" }),
      f("hero.title", "Headline", "Hygienic Street Food,", 60, { ne: "जहाँ स्वाद," }),
      f("hero.highlight", "Coloured end of the headline", "Bold Flavour", 40, { ne: "सरसफाइसँग मिल्छ" }),
      f("hero.text", "Text under the headline", "Chatpate in 4 signature varieties, momo & ice-cold drinks — prepared in our clean kitchen with fresh ingredients, delivered hot to your door.", 300,
        { multiline: true, ne: "चार किसिमका चटपटे, मोमो र चिसो पेय — ताजा सामग्रीले हाम्रो सफा भान्सामा बनाइएको, तातै तपाईंको ढोकासम्म।" }),
      f("hero.button", "Main button", "Order Now →", 30, { ne: "अहिले अर्डर गर्नुहोस् →" }),
      f("hero.button2", "Second button", "See Menu", 30, { ne: "मेनु हेर्नुहोस्" }),
      f("hero.badge1", "Badge 1", "Kitchen Hygiene Certified", 40, { ne: "भान्साको सरसफाइ प्रमाणित" }),
      f("hero.badge2", "Badge 2", "Fresh Ingredients Daily", 40, { ne: "हरेक दिन ताजा सामग्री" }),
      f("hero.badge3_delivery", "Badge 3 — when delivery is ON", "Free Delivery from Rs 99", 40, { ne: "रु 99 देखि निःशुल्क डेलिभरी" }),
      f("hero.badge3_pickup", "Badge 3 — when delivery is OFF", "Order Ahead for Pickup", 40, { ne: "पहिले अर्डर गरेर लिन आउनुहोस्" }),
      f("hero.badge4", "Badge 4", "Ready in 10–15 mins", 40, { ne: "10–15 मिनेटमै तयार" }),
    ],
  },
  {
    id: "about", title: "Why choose us", where: "/#about",
    fields: [
      f("about.eyebrow", "Small heading", "Why Choose Us", 40, { ne: "हामी नै किन?" }),
      f("about.title", "Heading", "Where Hygiene Meets Flavour", 80, { ne: "जहाँ सरसफाइ र स्वाद सँगै छन्" }),
      f("about.text", "Paragraph", "Thelawalaa brings the excitement of street food into a modern, hygienic format. Every dish is prepared fresh in our certified kitchen with premium ingredients — no shortcuts, no compromises. Just bold taste you can trust.", 500,
        { multiline: true, ne: "ठेलावालाले स्ट्रिट फुडको मज्जालाई सफा र आधुनिक तरिकामा ल्याएको छ। हरेक परिकार हाम्रो प्रमाणित भान्सामा, राम्रा सामग्रीले, ताजै बनाइन्छ — न छोटो बाटो, न कुनै सम्झौता। भरोसा गर्न सकिने स्वाद मात्र।" }),
      f("about.card1_title", "Card 1 title", "Certified Hygiene", 40, { ne: "प्रमाणित सरसफाइ" }),
      f("about.card1_text", "Card 1 text", "Prepared in a clean, sanitized kitchen with food-grade packaging for every order.", 200,
        { multiline: true, ne: "सफा र निर्मलीकरण गरिएको भान्सामा बनाइन्छ, र हरेक अर्डर खानाका लागि सुरक्षित प्याकेटमा।" }),
      f("about.card2_title", "Card 2 title", "4 Chatpate Varieties", 40, { ne: "चार किसिमका चटपटे" }),
      f("about.card2_text", "Card 2 text", "Classic, Gilo, Mint & Spicy Ramen — each with our signature house masala.", 200,
        { multiline: true, ne: "क्लासिक, गिलो, मिन्ट र स्पाइसी रामेन — सबैमा हाम्रो आफ्नै खास मसला।" }),
      f("about.card3_title", "Card 3 title", "Fresh Ingredients", 40, { ne: "ताजा सामग्री" }),
      f("about.card3_text", "Card 3 text", "Locally sourced vegetables, premium spices, and quality proteins — no preservatives.", 200,
        { multiline: true, ne: "स्थानीय तरकारी, राम्रा मसला र गुणस्तरीय प्रोटिन — कुनै प्रिजर्भेटिभ छैन।" }),
      f("about.card4_delivery_title", "Card 4 title — when delivery is ON", "Quick Delivery", 40, { ne: "छिटो डेलिभरी" }),
      f("about.card4_delivery_text", "Card 4 text — when delivery is ON", "Hot to your door within 5km of Godam Chowk — free on orders from Rs 99 (Rs 20 below) — or pick it up from our counter.", 200,
        { multiline: true, ne: "गोदाम चोकबाट 5 किलोमिटरभित्र तातै ढोकासम्म — रु 99 वा बढीको अर्डरमा निःशुल्क (कममा रु 20) — वा काउन्टरबाटै लैजानुहोस्।" }),
      f("about.card4_pickup_title", "Card 4 title — when delivery is OFF", "Easy Pickup", 40, { ne: "सजिलो पिकअप" }),
      f("about.card4_pickup_text", "Card 4 text — when delivery is OFF", "Order ahead and collect it hot from our Godam Chowk kitchen — no waiting in line.", 200,
        { multiline: true, ne: "पहिले नै अर्डर गर्नुहोस् र गोदाम चोकको भान्साबाट तातै लैजानुहोस् — लाइनमा पर्खनु पर्दैन।" }),
    ],
  },
  {
    id: "menu", title: "Bestsellers", where: "/#menu",
    fields: [
      f("menu.eyebrow", "Small heading", "Our Bestsellers", 40, { ne: "धेरै बिक्ने" }),
      f("menu.title", "Heading", "Most Loved by Our Customers", 80, { ne: "ग्राहकले सबैभन्दा मन पराएका" }),
      f("menu.button", "Button under the dishes", "View Full Menu & Order →", 40, { ne: "पूरा मेनु हेरेर अर्डर गर्नुहोस् →" }),
    ],
  },
  {
    id: "order", title: "How to order", where: "/#order",
    fields: [
      f("order.eyebrow", "Small heading", "Simple Process", 40, { ne: "सजिलो तरिका" }),
      f("order.title", "Heading", "How to Order", 60, { ne: "कसरी अर्डर गर्ने?" }),
      f("order.text", "Text under the heading", "Fresh food, ready in minutes. No app download required.", 200,
        { multiline: true, ne: "केही मिनेटमै ताजा खाना। कुनै एप डाउनलोड गर्नु पर्दैन।" }),
      f("order.video", "How-to-order video (YouTube link)", "https://www.youtube.com/shorts/CxZxRMS6Ld0", 200,
        { hint: "Paste any YouTube link — a Short, a normal video or youtu.be. Type off to hide the video." }),
      f("order.video_title", "Line under the video", "Watch: ordering takes a minute", 60, { ne: "हेर्नुहोस्: अर्डर गर्न एक मिनेट मात्र" }),
      f("order.step1_title", "Step 1 title", "Browse & Add", 40, { ne: "रोज्नुहोस् र थप्नुहोस्" }),
      f("order.step1_text", "Step 1 text", "Pick your favourites from our menu and add them to your cart.", 200,
        { multiline: true, ne: "मेनुबाट मन परेको खाना रोजेर कार्टमा थप्नुहोस्।" }),
      f("order.step2_delivery_title", "Step 2 title — when delivery is ON", "Choose Pickup or Delivery", 40, { ne: "पिकअप वा डेलिभरी रोज्नुहोस्" }),
      f("order.step2_delivery_text", "Step 2 text — when delivery is ON", "Collect from our Godam Chowk kitchen or get it delivered within 5km — free from Rs 99.", 200,
        { multiline: true, ne: "गोदाम चोकको भान्साबाट लैजानुहोस्, वा 5 किलोमिटरभित्र घरमै मगाउनुहोस् — रु 99 देखि निःशुल्क।" }),
      f("order.step2_pickup_title", "Step 2 title — when delivery is OFF", "Choose Pickup", 40, { ne: "पिकअप रोज्नुहोस्" }),
      f("order.step2_pickup_text", "Step 2 text — when delivery is OFF", "Collect it hot and fresh from our Godam Chowk kitchen.", 200,
        { multiline: true, ne: "गोदाम चोकको भान्साबाट तातै र ताजै लैजानुहोस्।" }),
      f("order.step3_title", "Step 3 title", "Pay on Arrival", 40, { ne: "खाना आएपछि तिर्नुहोस्" }),
      f("order.step3_text", "Step 3 text", "Pay cash or scan our eSewa/FonePay QR when your order arrives. Simple.", 200,
        { multiline: true, ne: "खाना हातमा आएपछि नगद दिनुहोस्, वा हाम्रो eSewa/FonePay QR स्क्यान गर्नुहोस्। सजिलो।" }),
      f("order.button_pickup", "Pickup button", "Order for Pickup", 30, { ne: "पिकअपका लागि अर्डर" }),
      f("order.button_delivery", "Delivery button (only when delivery is ON)", "Order for Delivery", 30, { ne: "डेलिभरीका लागि अर्डर" }),
    ],
  },
  {
    id: "faq", title: "Questions (FAQ)", where: "/#faq",
    fields: [
      f("faq.eyebrow", "Small heading", "Got Questions?", 40, { ne: "केही सोध्नु छ?" }),
      f("faq.title", "Heading", "Frequently Asked Questions", 60,
        { ne: "धेरैले सोध्ने प्रश्नहरू", hint: "The questions themselves are in Admin → FAQs (English only — the Nepali page shows them too)." }),
    ],
  },
  {
    id: "contact", title: "Contact form", where: "/#contact",
    fields: [
      f("contact.eyebrow", "Small heading", "Get In Touch", 40, { ne: "सम्पर्क गर्नुहोस्" }),
      f("contact.title", "Heading", "Say Hello", 60, { ne: "हामीलाई लेख्नुहोस्" }),
      f("contact.franchise_title", "Franchise box — bold start", "Franchise enquiries welcome.", 60, { ne: "फ्रेन्चाइजका लागि सोधपुछ स्वागत छ।" }),
      f("contact.franchise_text", "Franchise box — rest", "We're building Thelawalaa into a trusted street-food brand across Nepal — reach out to partner with us.", 300,
        { multiline: true, ne: "हामी ठेलावालालाई नेपालभरि भरोसायोग्य स्ट्रिट फुड ब्रान्ड बनाउँदैछौं — साझेदारी गर्न सम्पर्क गर्नुहोस्।" }),
      f("contact.whatsapp", "WhatsApp number (with 977)", "9779801011111", 15,
        { hint: "Digits only, starting 977 — used by every WhatsApp button on the site." }),
    ],
  },
  {
    // The map at the bottom of the homepage, plus the address / hours line in the top part.
    id: "location", title: "Find us — map & opening hours", where: "/#location",
    fields: [
      f("location.eyebrow", "Small heading", "Find Us", 40, { ne: "हामी कहाँ छौं?" }),
      f("location.title", "Heading", "Visit Our Kitchen", 60, { ne: "हाम्रो भान्सामा आउनुहोस्" }),
      f("location.text", "Text under the heading", "Collect your order or eat at our counter. Tap Get directions and Google Maps brings you straight to us.", 300,
        { multiline: true, ne: "अर्डर लिन वा यहीँ बसेर खान हाम्रो काउन्टरमा आउनुहोस्। “बाटो हेर्नुहोस्” थिच्नुहोस्, गुगल म्यापले सिधै हामीकहाँ ल्याउँछ।" }),
      f("location.directions", "Directions button", "Get directions", 30, { ne: "बाटो हेर्नुहोस्" }),
      f("contact.kitchen", "Shop name", "Thelawalaa Kitchen", 60, { ne: "ठेलावाला भान्सा" }),
      f("contact.address", "Address", "Godam Chowk, Banepa, Kavrepalanchok", 120, { ne: "गोदाम चोक, बनेपा, काभ्रेपलाञ्चोक" }),
      f("contact.hours_title", "Opening hours heading", "Opening Hours", 40, { ne: "खुल्ने समय" }),
      f("contact.hours_days", "Opening days", "Every day", 40,
        { ne: "हरेक दिन", hint: "The times next to it come from Admin → Settings → Store hours, so they always match when orders are taken." }),
      f("contact.delivery", "Delivery line (only when delivery is ON)", "Delivery within 5km of Godam Chowk — free from Rs 99, Rs 20 below", 100,
        { ne: "गोदाम चोकबाट 5 किलोमिटरभित्र डेलिभरी — रु 99 देखि निःशुल्क, कममा रु 20" }),
    ],
  },
  {
    id: "footer", title: "Footer", where: "/#home",
    fields: [
      f("footer.tagline", "Line under the logo", "Crispy, spicy, straight from the thela — now at your door.", 120,
        { ne: "स्वादले भरिपूर्ण — अब तपाईंको ढोकामा।" }),
    ],
  },
  {
    // /terms. Each section: a heading + its text. In the text, a blank line
    // starts a new paragraph and a line starting with "- " is a bullet point.
    id: "terms", title: "Terms & Conditions", where: "/terms",
    fields: [
      f("terms.updated", "Last updated (date)", "11 October 2026", 40, { hint: "Change this whenever you change the terms." }),
      f("terms.intro", "Introduction", "These terms apply when you use thelawalaa.com, create an account, order from us (online or at our Godam Chowk counter), join our offers, or take part in a promotion or competition. By creating an account or placing an order, you agree to them.\n\nThelawalaa (\"we\", \"us\") is a street-food kitchen at Godam Chowk, Banepa, Kavrepalanchok, Nepal.", 2000, { multiline: true }),
      f("terms.orders_title", "Section 1 heading", "Orders, prices and payment", 60),
      f("terms.orders", "Section 1 text", "- Prices are in Nepali rupees. Prices, menu items and availability can change at any time without notice.\n- An order is accepted once we confirm it. We may refuse or cancel an order — for example if an item has sold out, a price was shown wrongly, the details given are incomplete, or we suspect misuse. If you have already paid for an order we cancel, we refund it.\n- Pay with cash, QR or eSewa as offered at checkout. Pay-on-arrival orders must be paid in full when you collect or receive them.\n- Photos are for illustration. Every dish is made fresh and may look slightly different.", 2000, { multiline: true }),
      f("terms.delivery_title", "Section 2 heading", "Pickup and delivery", 60),
      f("terms.delivery", "Section 2 text", "- Home delivery is only offered within about 5 km of our Godam Chowk kitchen, when delivery is available. Delivery is free when the food comes to Rs 99 or more (before vouchers or points); below that it costs Rs 20. We may change the delivery charge at any time.\n- Give a complete address and a mobile number we can reach. If you share your location, we use it only to deliver that order.\n- Delivery and ready times are estimates. Traffic, weather and busy hours can cause delays.\n- Our rider may ask for your 2-digit delivery code before handing the order over. If nobody can receive the order, or the address can't be found after reasonable effort, the order may be cancelled without a refund for food already prepared.\n- Please collect pickup orders within 30 minutes of them being ready — we can't guarantee the food after that.", 2000, { multiline: true }),
      f("terms.offers_title", "Section 3 heading", "Offers, promotions and competitions", 60),
      f("terms.offers", "Section 3 text", "- All offers, discounts, promo codes, deals, opening-day prices, rewards and competitions are run at our sole discretion. We may change, suspend or withdraw any of them at any time, without notice and without giving a reason.\n- Unless an offer says otherwise: one offer per order, offers can't be combined, they have no cash value, can't be exchanged or transferred, and last while stocks last.\n- Promo codes may have a minimum order, an end date and a limited number of uses. A code that has ended or run out can't be applied afterwards.\n- Competitions are open to people living in Nepal with a Thelawalaa account, unless the competition says otherwise. Our staff and their families may be excluded. Winners are chosen as the competition describes and our decision is final. Prizes are as stated, can't be swapped for cash, and may be replaced with something of similar value. Prizes not claimed within 14 days may be withdrawn. We may announce winners by first name and town.\n- We may cancel any discount, prize, points or reward gained through misuse, mistakes, fraud or more than one account.", 2000, { multiline: true }),
      f("terms.rewards_title", "Section 4 heading", "Rewards points", 60),
      f("terms.rewards", "Section 4 text", "- Signed-in customers earn points on paid orders at the rates shown in their account, and can use them as a discount at checkout once they reach the minimum shown.\n- Points and free items have no cash value, can't be transferred or sold, and aren't given for cancelled or unpaid orders. Points used on a cancelled order are given back; points earned on it are taken back.\n- We may change how points are earned, what they're worth and the free-item rules, or end the rewards programme, at any time without notice. If the programme ends, unused points end with it.", 2000, { multiline: true }),
      f("terms.marketing_title", "Section 5 heading", "Offers messages and your choices", 60),
      f("terms.marketing", "Section 5 text", "- We only send you offers, promotions and competition news if you choose to join — with the tick box when you sign up, or the Join button in your account. You are never joined automatically.\n- You can leave at any time from your profile, or with the unsubscribe link in any offers email. Leaving doesn't affect your account, points or orders.\n- Order confirmations and account or security emails are part of our service, so you get them even if you haven't joined offers.", 2000, { multiline: true }),
      f("terms.account_title", "Section 6 heading", "Your account", 60),
      f("terms.account", "Section 6 text", "- Keep your password private and sign out on shared phones. You are responsible for orders placed from your account.\n- Give true details, and keep to one account per person.\n- We may suspend or close an account that is misused, used for fraud, or used to abuse our staff.", 2000, { multiline: true }),
      f("terms.food_title", "Section 7 heading", "Food, allergies and hygiene", 60),
      f("terms.food", "Section 7 text", "- Our kitchen handles nuts, gluten, dairy, soy, eggs, sesame and other allergens. We can't promise that any dish is free of them — please ask our staff before ordering if you have an allergy.\n- Spice levels are a guide. Please eat your food soon after you collect or receive it.", 2000, { multiline: true }),
      f("terms.liability_title", "Section 8 heading", "If something goes wrong", 60),
      f("terms.liability", "Section 8 text", "- If something is wrong with your order, tell us the same day — on WhatsApp or our feedback page — and we'll put it right with a replacement, a refund or credit, as we think fair.\n- We aren't responsible for delays or problems caused by things outside our control, such as strikes, bandhs, bad weather, or power and network cuts. Our responsibility for any order is limited to the amount you paid for it.\n- Nothing in these terms takes away your rights under Nepal's consumer protection laws.", 2000, { multiline: true }),
      f("terms.privacy_title", "Section 9 heading", "Privacy — how we use your information", 60),
      f("terms.privacy", "Section 9 text", "- What we keep: your name, mobile number, email, delivery addresses, the location you choose to share for a delivery, and your orders and points.\n- Why: to take, make and deliver your orders, run your account and rewards, reply to your feedback, prevent fraud and — only if you joined — send you offers.\n- Who sees it: only our staff who need it for your order. Riders see your first name, the delivery address and location and the items, and can call you from the app while delivering. We never sell your details. We use trusted services to run the website (hosting, database and email).\n- Your shared location is used only for the order you shared it with.\n- To see, correct or delete your details, message us.", 2000, { multiline: true }),
      f("terms.changes_title", "Section 10 heading", "Changes, law and contact", 60),
      f("terms.changes", "Section 10 text", "- We may update these terms from time to time. The latest version is always on this page, with the date it last changed. Using our website or ordering after a change means you accept it.\n- These terms are governed by the laws of Nepal, and the courts of Kavrepalanchok have jurisdiction.\n- Questions? Message us on WhatsApp or use our feedback page.", 2000, { multiline: true }),
    ],
  },
] as const satisfies readonly Section[];

type Sections = typeof SITE_TEXT_SECTIONS;
export type SiteTextKey = Sections[number]["fields"][number]["key"];
export type SiteText = Record<SiteTextKey, string>;

export const SITE_TEXT_FIELDS: readonly Field[] = SITE_TEXT_SECTIONS.flatMap((s): readonly Field[] => s.fields);
export const SITE_TEXT_DEFAULTS = Object.fromEntries(SITE_TEXT_FIELDS.map((x) => [x.key, x.default])) as SiteText;

/** Where a field's Nepali version is stored. */
export const neKey = (key: string) => `ne.${key}`;
/** Everything that can be saved: each field, plus its Nepali version where it has one. */
export const SITE_TEXT_INPUTS: readonly Field[] = SITE_TEXT_FIELDS.flatMap((x): Field[] => x.ne == null ? [x] : [
  x, { key: neKey(x.key), label: `${x.label} (Nepali)`, default: x.ne, max: x.neMax ?? x.max, multiline: x.multiline },
]);

const savedText = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("site_content").select("key, value");
  return new Map((data ?? []).map((r) => [r.key as string, r.value as string]));
});

/** The website text as it should show right now: saved changes over the defaults, in English or (for /ne) Nepali. One read per request. */
export const getSiteText = cache(async (lang: SiteLang = "en"): Promise<SiteText> => {
  const pick = (saved: Map<string, string>) => Object.fromEntries(SITE_TEXT_FIELDS.map((x) => [x.key,
    lang === "ne" && x.ne != null ? saved.get(neKey(x.key)) ?? x.ne : saved.get(x.key) ?? x.default])) as SiteText;
  try {
    return pick(await savedText());
  } catch {
    return pick(new Map()); // the site never breaks over its wording
  }
});

/** wa.me link for the editable WhatsApp number. */
export const whatsappHref = (t: Pick<SiteText, "contact.whatsapp">, text?: string) =>
  `https://wa.me/${t["contact.whatsapp"].replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
