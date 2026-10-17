// English / Nepali for the homepage. The Nepali homepage is /ne (its own URL,
// so Google can list it for Nepali searches); every other page is English.
// The wording of each homepage section is editable website text
// (lib/site-content.ts, with a Nepali box per field); this file holds only
// the small fixed words around it — menu links, labels, "Open now".
// No server-only imports: client components use it too.

export type SiteLang = "en" | "ne";

export const langOfPath = (path: string | null | undefined): SiteLang =>
  path === "/ne" || path?.startsWith("/ne/") ? "ne" : "en";
export const homePath = (lang: SiteLang) => (lang === "ne" ? "/ne" : "/");
/** Light / dark for the website (English and Nepali pages alike), set by the moon button in the top bar. */
export const SITE_THEME_COOKIE = "site-theme";

const EN = {
  nav: { home: "Home", about: "About", menu: "Menu", order: "Order Now", faq: "FAQ", contact: "Contact", location: "Find Us" },
  signIn: "Sign in", myAccount: "My account", myPortal: "My portal",
  // The button that switches language is written in the language it switches TO.
  switchTo: "नेपाली", switchAria: "यो पेज नेपालीमा हेर्नुहोस्",
  theme: { toDark: "Switch to dark mode", toLight: "Switch to light mode" },
  mobile: { home: "Home", menu: "Menu", order: "Order", location: "Find us", signIn: "Sign in", portal: "My portal" },
  footer: { follow: "Follow Us", order: "Order", feedback: "Feedback", terms: "Terms & Conditions", privacy: "Privacy", rights: "All rights reserved",
    explore: "Explore", help: "Order & help", visit: "Visit us", howToOrder: "How to order", orderOnline: "Order online", chat: "Chat on WhatsApp", careers: "Careers" },
  heroAlt: "Thelawalaa chatpate and momo in branded takeaway boxes",
  veg: "Veg", nonVeg: "Non-Veg", spiceAria: "Spice", spice: ["Mild", "Medium", "Hot", "Extra hot"],
  openingOffer: "Opening offer",
  add: "Add", added: (name: string) => `${name} added`,
  delivery: "Delivery",
  chatWhatsapp: "Chat on WhatsApp",
  video: { play: "Play", replay: "Watch again", close: "Close the video" },
  mapTitle: "Map showing Thelawalaa at Godam Chowk, Banepa",
  openNow: "Open now", closedNow: "Closed now",
  opens: (time: string, tomorrow: boolean) => `opens ${tomorrow ? "tomorrow " : ""}${time}`,
  form: { name: "Name", email: "Email", phone: "Phone (optional)", message: "Message", send: "Send message", sending: "Sending…", sent: "Message sent — we'll reply soon!" },
};

const NE: typeof EN = {
  nav: { home: "गृहपृष्ठ", about: "हाम्रो बारेमा", menu: "मेनु", order: "अर्डर गर्नुहोस्", faq: "प्रश्नहरू", contact: "सम्पर्क", location: "हामी कहाँ छौं" },
  signIn: "साइन इन", myAccount: "मेरो खाता", myPortal: "मेरो पोर्टल",
  switchTo: "English", switchAria: "See this page in English",
  theme: { toDark: "डार्क मोडमा हेर्नुहोस्", toLight: "लाइट मोडमा हेर्नुहोस्" },
  mobile: { home: "गृहपृष्ठ", menu: "मेनु", order: "अर्डर", location: "ठेगाना", signIn: "साइन इन", portal: "पोर्टल" },
  footer: { follow: "हामीलाई फलो गर्नुहोस्", order: "अर्डर", feedback: "सुझाव", terms: "नियम र सर्तहरू", privacy: "गोपनीयता", rights: "सर्वाधिकार सुरक्षित",
    explore: "हेर्नुहोस्", help: "अर्डर र सहयोग", visit: "हामीकहाँ आउनुहोस्", howToOrder: "कसरी अर्डर गर्ने", orderOnline: "अनलाइन अर्डर", chat: "व्हाट्सएपमा कुरा गर्नुहोस्", careers: "रोजगारी" },
  heroAlt: "ठेलावालाको ब्रान्डेड बट्टामा चटपटे र मोमो",
  veg: "शाकाहारी", nonVeg: "मांसाहारी", spiceAria: "पिरो", spice: ["कम पिरो", "मध्यम पिरो", "पिरो", "धेरै पिरो"],
  openingOffer: "उद्घाटन अफर",
  add: "थप्नुहोस्", added: (name: string) => `${name} कार्टमा थपियो`,
  delivery: "डेलिभरी",
  chatWhatsapp: "व्हाट्सएपमा कुरा गर्नुहोस्",
  video: { play: "हेर्नुहोस्", replay: "फेरि हेर्नुहोस्", close: "भिडियो बन्द गर्नुहोस्" },
  mapTitle: "गोदाम चोक, बनेपामा ठेलावाला देखाउने नक्सा",
  openNow: "अहिले खुला छ", closedNow: "अहिले बन्द छ",
  opens: (time: string, tomorrow: boolean) => `${tomorrow ? "भोलि " : ""}${time} खुल्छ`,
  form: { name: "नाम", email: "इमेल", phone: "फोन (चाहे मात्र)", message: "सन्देश", send: "सन्देश पठाउनुहोस्", sending: "पठाउँदै…", sent: "सन्देश पुग्यो — हामी छिट्टै जवाफ दिन्छौं!" },
};

export const UI: Record<SiteLang, typeof EN> = { en: EN, ne: NE };

/** "9:00 am" / "बिहान 9 बजे" — minutes after midnight, Banepa time. */
export function clockText(min: number, lang: SiteLang) {
  const h = Math.floor(min / 60) % 24, m = min % 60, h12 = ((h + 11) % 12) + 1;
  const mm = String(m).padStart(2, "0");
  if (lang === "en") return `${h12}:${mm} ${h < 12 ? "am" : "pm"}`;
  const part = h < 4 ? "राति" : h < 12 ? "बिहान" : h < 16 ? "दिउँसो" : h < 19 ? "साँझ" : "बेलुका";
  return `${part} ${h12}${m ? `:${mm}` : ""} बजे`;
}

/** "9:00 am – 7:00 pm" / "बिहान 9 बजेदेखि बेलुका 7 बजेसम्म". */
export const hoursText = (start: number, end: number, lang: SiteLang) =>
  lang === "en" ? `${clockText(start, "en")} – ${clockText(end, "en")}` : `${clockText(start, "ne")}देखि ${clockText(end, "ne")}सम्म`;
