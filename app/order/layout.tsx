import type { Metadata } from "next";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Order Chatpate & Momo Online in Banepa",
  description:
    "Order Thelawalaa street food online for pickup or home delivery in Banepa–Godam Chowk — chatpate (Classic, Gilo, Mint, Spicy Ramen) and momo (Veg, Chicken, Buff). Flat Nrs 20 delivery within 5km.",
  alternates: { canonical: "/order" },
  openGraph: {
    title: `Order Online · ${SITE.name}`,
    description: "Fresh chatpate and momo delivered hot across Banepa–Godam Chowk.",
    url: `${SITE.url}/order`,
  },
};

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
