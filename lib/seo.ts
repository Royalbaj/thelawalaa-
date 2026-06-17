/**
 * Central SEO + business config. Edit business facts here once and they
 * flow into metadata, JSON-LD structured data, the sitemap and manifest.
 *
 * Launch market: Butwal – Manigram, Rupandehi, Nepal.
 * Vision: build a recognisable street-food brand and franchise it,
 * starting from Butwal and expanding outward.
 *
 * Ranking note: the biggest off-page factors are a Google Business
 * Profile for the Manigram store, real customer reviews, and local
 * links. The code makes the site technically perfect; pair it with
 * those to compete honestly for the top local spots.
 */
export const SITE = {
  name: "Thelawalaa",
  legalName: "Thelawalaa Street Food",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://thelawalaa.com",
  description:
    "Thelawalaa serves Butwal's most flavourful chatpate, panipuri, fulki and momo — hygienic, freshly made, and delivered hot to your door within 5km of Manigram for just Nrs 20. Chicken, spicy ramen, mint, sweet chilly & spicy chatpate varieties.",
  tagline: "Butwal's Most Flavourful Chatpate, Panipuri, Fulki & Momo",
  locale: "en_NP",
  currency: "NPR",
  twitter: "@thelawalaa",
  telephone: "+977-9801011111",
  email: "hello@thelawalaa.com",
  // USP — surfaced in copy and metadata.
  usp: {
    delivery: "Home delivery within 5km of our Manigram store — flat Nrs 20",
    pillars: ["Hygiene", "Flavour", "Variety", "Pickup & home delivery"],
    deliveryFee: 20,
    deliveryRadiusKm: 5,
  },
  // Keywords the brand genuinely serves — brand, dishes, varieties, locality.
  keywords: [
    "Thelawalaa", "Thelawala", "thelawalaa",
    "chatpate", "chatpate Butwal", "chatpate Manigram", "chatpate near me",
    "chicken chatpate", "spicy ramen chatpate", "ramen chatpate",
    "mint chatpate", "sweet chilly chatpate", "spicy chatpate",
    "panipuri", "pani puri", "panipuri Butwal", "panipuri near me",
    "fulki", "fulki Butwal", "golgappa",
    "momo", "momo Butwal", "momo Manigram", "momo near me",
    "street food Butwal", "street food Manigram", "street food Rupandehi",
    "food delivery Butwal", "home delivery Butwal", "food delivery Manigram",
    "best chatpate in Butwal", "best momo in Butwal", "best panipuri in Butwal",
  ],
  geo: { lat: 27.6727, lng: 83.4655, region: "NP", city: "Butwal" },
  branches: [
    {
      name: "Thelawalaa — Manigram", street: "Manigram, Tilottama",
      city: "Butwal", region: "Rupandehi", postal: "32907",
      phone: "+977-9801011111",
      lat: 27.6450, lng: 83.4480,
    },
  ],
  social: [
    "https://www.facebook.com/thelawalaa",
    "https://www.instagram.com/thelawalaa",
    "https://www.tiktok.com/@thelawalaa",
  ],
  openingHours: "Mo-Su 10:00-21:00",
} as const;
