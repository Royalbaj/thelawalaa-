import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE.url, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/order`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/#menu`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE.url}/#about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/#contact`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/auth/login`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE.url}/auth/signup`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
