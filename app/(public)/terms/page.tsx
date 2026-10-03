import type { Metadata } from "next";
import { getSiteText, type SiteText } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "Thelawalaa's terms for orders, delivery, offers, competitions, rewards and how we use your information.",
  alternates: { canonical: "/terms" },
};

const SECTIONS = [
  { id: "orders", title: "terms.orders_title", body: "terms.orders" },
  { id: "delivery", title: "terms.delivery_title", body: "terms.delivery" },
  { id: "offers", title: "terms.offers_title", body: "terms.offers" },
  { id: "rewards", title: "terms.rewards_title", body: "terms.rewards" },
  { id: "marketing", title: "terms.marketing_title", body: "terms.marketing" },
  { id: "account", title: "terms.account_title", body: "terms.account" },
  { id: "food", title: "terms.food_title", body: "terms.food" },
  { id: "liability", title: "terms.liability_title", body: "terms.liability" },
  { id: "privacy", title: "terms.privacy_title", body: "terms.privacy" },
  { id: "changes", title: "terms.changes_title", body: "terms.changes" },
] as const satisfies readonly { id: string; title: keyof SiteText; body: keyof SiteText }[];

/** Editable plain text → paragraphs and bullet lists ("- " lines). */
function Body({ text }: { text: string }) {
  const blocks: ({ kind: "p"; text: string } | { kind: "ul"; items: string[] })[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const last = blocks[blocks.length - 1];
    if (!line) { blocks.push({ kind: "p", text: "" }); continue; }
    if (line.startsWith("- ")) {
      if (last?.kind === "ul") last.items.push(line.slice(2));
      else blocks.push({ kind: "ul", items: [line.slice(2)] });
    } else if (last?.kind === "p" && last.text) last.text += ` ${line}`;
    else blocks.push({ kind: "p", text: line });
  }
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-stone-700">
      {blocks.map((b, i) => b.kind === "ul" ? (
        <ul key={i} className="space-y-2.5">
          {b.items.map((item, j) => (
            <li key={j} className="flex gap-3"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" /><span>{item}</span></li>
          ))}
        </ul>
      ) : b.text ? <p key={i}>{b.text}</p> : null)}
    </div>
  );
}

export default async function TermsPage() {
  const t = await getSiteText();
  return (
    <section className="bg-brand-cream px-4 py-10 md:py-16">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-24 space-y-1 text-sm">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-stone-400">On this page</p>
            {SECTIONS.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} className="block rounded-lg px-3 py-1.5 font-bold text-stone-600 hover:bg-white hover:text-brand-orange">
                {i + 1}. {t[s.title]}
              </a>
            ))}
          </nav>
        </aside>

        <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-100 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">Legal</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-brand-brown md:text-4xl">Terms &amp; Conditions</h1>
          <p className="mt-2 text-sm text-stone-500">Last updated: {t["terms.updated"]}</p>
          <div className="mt-6 border-b border-stone-100 pb-6"><Body text={t["terms.intro"]} /></div>

          {SECTIONS.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 border-b border-stone-100 py-7 last:border-0 last:pb-0">
              <h2 className="mb-4 font-display text-xl font-bold text-brand-brown">{i + 1}. {t[s.title]}</h2>
              <Body text={t[s.body]} />
            </section>
          ))}
        </article>
      </div>
    </section>
  );
}
