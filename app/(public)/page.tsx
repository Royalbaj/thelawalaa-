import type { Metadata } from "next";
import { SITE } from "@/lib/seo";
import HomePage from "@/components/home/home-page";

export const revalidate = 300;

export const metadata: Metadata = {
  // absolute: the layout's "%s · Thelawalaa" template would repeat the name.
  title: { absolute: `${SITE.name} — ${SITE.tagline}` },
  description: SITE.description,
  // The same page in Nepali is /ne (app/ne).
  alternates: { canonical: "/", languages: { "en-NP": "/", "ne-NP": "/ne", "x-default": "/" } },
};

export default function Home() {
  return <HomePage lang="en" />;
}
