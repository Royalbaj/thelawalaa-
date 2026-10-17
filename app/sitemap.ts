import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

// Only real, indexable pages: no #section links (Google ignores them) and
// nothing robots.txt blocks (/auth etc.), or Search Console flags it.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  // The homepage in English (/) and Nepali (/ne), each pointing at the other.
  const languages = { "en-NP": SITE.url, "ne-NP": `${SITE.url}/ne` };
  return [
    { url: SITE.url, lastModified: now, changeFrequency: "daily", priority: 1, alternates: { languages } },
    { url: `${SITE.url}/ne`, lastModified: now, changeFrequency: "daily", priority: 0.9, alternates: { languages } },
    { url: `${SITE.url}/order`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/careers`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE.url}/feedback`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE.url}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
