import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSiteText } from "@/lib/site-content";
import { nepalToday } from "@/lib/dates";
import CareersBoard, { type Listing } from "@/components/careers/careers-board";

export const metadata: Metadata = {
  title: "Careers — jobs at Thelawalaa, Banepa",
  description: "Work at Thelawalaa, Godam Chowk, Banepa — see the open jobs and apply, or send your CV for the next opening.",
  alternates: { canonical: "/careers" },
};

// Fresh on every visit: a job closed in Admin → Careers must disappear at once.
export const dynamic = "force-dynamic";

export default async function CareersPage() {
  const [t, { data }] = await Promise.all([
    getSiteText(),
    // Service role (the table has no public policy): only open jobs, and only these columns.
    supabaseAdmin.from("job_listings")
      .select("id, title, job_type, description, requirements, pay, openings, closes_on")
      .eq("is_open", true).order("created_at", { ascending: false }),
  ]);
  const today = nepalToday();
  const listings = ((data ?? []) as Listing[]).filter((j) => !j.closes_on || j.closes_on >= today);

  return (
    <section className="bg-brand-cream px-4 py-10 dark:bg-stone-950 md:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 max-w-2xl">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-orange">{t["careers.eyebrow"]}</p>
          <h1 className="font-display text-3xl font-bold text-brand-brown dark:text-orange-50 md:text-4xl">{t["careers.title"]}</h1>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-stone-600 dark:text-stone-300">{t["careers.text"]}</p>
        </div>
        <CareersBoard listings={listings} text={{
          noneTitle: t["careers.none_title"], noneText: t["careers.none_text"],
          formTitle: t["careers.form_title"], privacy: t["careers.privacy"],
        }} />
      </div>
    </section>
  );
}
