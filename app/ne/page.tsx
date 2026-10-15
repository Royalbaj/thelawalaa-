import type { Metadata } from "next";
import { SITE } from "@/lib/seo";
import HomePage from "@/components/home/home-page";

export const revalidate = 300;

const title = "ठेलावाला — बनेपाको सफा र स्वादिलो स्ट्रिट फुड";
const description = "गोदाम चोक, बनेपामा चटपटे, मोमो र चिसो पेय। सफा भान्सामा ताजै बनाइएको — अनलाइन अर्डर गरेर लैजानुहोस् वा घरमै मगाउनुहोस्।";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/ne", languages: { "en-NP": "/", "ne-NP": "/ne", "x-default": "/" } },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "ne_NP",
    url: `${SITE.url}/ne`,
    title,
    description,
    images: [{ url: "/og.png?v=2", width: 1200, height: 630, alt: "ठेलावाला — गोदाम चोक, बनेपाको चटपटे र मोमो" }],
  },
};

export default function NepaliHome() {
  return <HomePage lang="ne" />;
}
