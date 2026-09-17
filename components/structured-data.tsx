import { SITE } from "@/lib/seo";

/**
 * JSON-LD structured data. This is what earns rich results in Google:
 * the local-business knowledge panel, menu, star ratings, the FAQ
 * accordion, and the sitelinks search box. Rendered server-side in
 * <head> so crawlers see it immediately.
 */

type FaqItem = { q: string; a: string };
type MenuItem = { name: string; description?: string | null; price: number };

export default function StructuredData({
  faqs = [], menu = [],
}: { faqs?: FaqItem[]; menu?: MenuItem[] }) {
  const branchNodes = SITE.branches.map((b, i) => ({
    "@type": "Restaurant",
    "@id": `${SITE.url}/#branch-${i}`,
    name: b.name,
    servesCuisine: ["Street Food", "Nepali", "Chatpate", "Momo", "Chaat"],
    priceRange: "Rs",
    image: `${SITE.url}/og.png`,
    url: SITE.url,
    telephone: b.phone,
    address: {
      "@type": "PostalAddress",
      streetAddress: b.street,
      addressLocality: b.city,
      postalCode: b.postal,
      addressCountry: "NP",
    },
    geo: { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lng },
    openingHours: SITE.openingHours,
    acceptsReservations: false,
    menu: `${SITE.url}/#menu`,
  }));

  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#organization`,
      name: SITE.name,
      legalName: SITE.legalName,
      url: SITE.url,
      logo: { "@type": "ImageObject", url: `${SITE.url}/icon.svg` },
      email: SITE.email,
      telephone: SITE.telephone,
      sameAs: [...SITE.social],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      url: SITE.url,
      name: SITE.name,
      description: SITE.description,
      publisher: { "@id": `${SITE.url}/#organization` },
      inLanguage: "en-NP",
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/order?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "FoodEstablishment",
      "@id": `${SITE.url}/#business`,
      name: SITE.name,
      description: SITE.description,
      url: SITE.url,
      telephone: SITE.telephone,
      servesCuisine: ["Street Food", "Chatpate", "Momo", "Nepali"],
      priceRange: "Rs",
      image: `${SITE.url}/og.png`,
      hasMenu: menu.length
        ? {
            "@type": "Menu",
            name: "Thelawalaa Menu",
            hasMenuSection: {
              "@type": "MenuSection",
              name: "Street Food & Chaat",
              hasMenuItem: menu.map((m) => ({
                "@type": "MenuItem",
                name: m.name,
                ...(m.description ? { description: m.description } : {}),
                offers: { "@type": "Offer", price: m.price, priceCurrency: "NPR" },
              })),
            },
          }
        : undefined,
      address: branchNodes.map((b) => b.address),
      areaServed: ["Banepa", "Godam Chowk", "Kavrepalanchok"],
      sameAs: [...SITE.social],
    },
    ...branchNodes,
  ];

  if (faqs.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${SITE.url}/#faq`,
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  const json = { "@context": "https://schema.org", "@graph": graph };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
