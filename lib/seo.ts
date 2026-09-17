/**
 * Central SEO + business config. Edit business facts here once and they
 * flow into metadata, JSON-LD structured data, the sitemap and manifest.
 *
 * Launch market: Banepa – Godam Chowk, Kavrepalanchok, Nepal.
 * Vision: build a recognisable street-food brand and franchise it,
 * starting from Banepa and expanding outward.
 *
 * TODO before production: verify the exact Godam Chowk store lat/lng
 * and postal code below — geo.lat/lng and branches[0].lat/lng are
 * approximate (Banepa town center), and the postal code is unconfirmed.
 *
 * Ranking note: the biggest off-page factors are a Google Business
 * Profile for the Godam Chowk store, real customer reviews, and local
 * links. The code makes the site technically perfect; pair it with
 * those to compete honestly for the top local spots.
 */
export const SITE = {
  name: "Thelawalaa",
  legalName: "Thelawalaa Street Food",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://thelawalaa.com",
  description:
    "Thelawalaa serves Banepa's most flavourful chatpate and momo — hygienic, freshly made, and delivered hot to your door within 5km of Godam Chowk for just Nrs 20. Classic, Gilo, Mint & Spicy Ramen chatpate, plus Veg, Chicken & Buff momo.",
  tagline: "Banepa's Most Flavourful Chatpate & Momo",
  locale: "en_NP",
  currency: "NPR",
  twitter: "@thelawalaa",
  telephone: "+977-9801011111",
  email: "hello@thelawalaa.com",
  // USP — surfaced in copy and metadata.
  usp: {
    delivery: "Home delivery within 5km of our Godam Chowk store — flat Nrs 20",
    pillars: ["Hygiene", "Flavour", "Variety", "Pickup & home delivery"],
    deliveryFee: 20,
    deliveryRadiusKm: 5,
  },
  // Keywords the brand genuinely serves — brand, dishes, varieties, locality.
  keywords: [
    "Thelawalaa", "Thelawala", "thelawalaa",
    "chatpate", "chatpate Banepa", "chatpate Godam Chowk", "chatpate near me",
    "gilo chatpate", "spicy ramen chatpate", "ramen chatpate", "mint chatpate",
    "momo", "momo Banepa", "momo Godam Chowk", "momo near me",
    "veg momo", "chicken momo", "buff momo", "buff momo Banepa",
    "street food Banepa", "street food Godam Chowk", "street food Kavrepalanchok",
    "food delivery Banepa", "home delivery Banepa", "food delivery Kavre",
    "best chatpate in Banepa", "best momo in Banepa", "best buff momo in Banepa",
  ],
  geo: { lat: 27.6316, lng: 85.5216, region: "NP", city: "Banepa" },
  branches: [
    {
      name: "Thelawalaa — Godam Chowk", street: "Godam Chowk",
      city: "Banepa", region: "Kavrepalanchok", postal: "45210",
      phone: "+977-9801011111",
      lat: 27.6316, lng: 85.5216,
    },
  ],
  social: [
    "https://www.facebook.com/thelawalaa",
    "https://www.instagram.com/thelawalaa",
    "https://www.tiktok.com/@thelawalaa",
  ],
  openingHours: "Mo-Su 10:00-21:00",
} as const;
