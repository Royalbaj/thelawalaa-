import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Order Chatpate, Panipuri, Fulki & Momo Online in Butwal",
  description:
    "Order Thelawalaa street food online for pickup or home delivery in Butwal–Manigram — chatpate (Chicken, Spicy Ramen, Mint, Sweet Chilly, Spicy), panipuri, fulki and momo. Flat Nrs 20 delivery within 5km.",
  alternates: { canonical: "/order" },
  openGraph: {
    title: `Order Online · ${SITE.name}`,
    description: "Fresh chatpate, panipuri, fulki and momo delivered hot across Butwal–Manigram.",
    url: `${SITE.url}/order`,
  },
};

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
