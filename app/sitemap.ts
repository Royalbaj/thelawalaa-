import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

// Only real, indexable pages: no #section links (Google ignores them) and
// nothing robots.txt blocks (/auth etc.), or Search Console flags it.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE.url, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/order`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/feedback`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE.url}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
