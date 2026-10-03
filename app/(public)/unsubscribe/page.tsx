import type { Metadata } from "next";
import UnsubscribeButton from "@/components/account/unsubscribe-button";

export const metadata: Metadata = {
  title: "Unsubscribe from offers",
  robots: { index: false, follow: false },
};

// From the link in an offers email. A button (not the link itself) does it,
// so inbox link-scanners opening the page can't unsubscribe anyone.
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ u?: string; t?: string }> }) {
  const { u = "", t = "" } = await searchParams;
  return (
    <section className="bg-brand-cream px-4 py-16 md:py-24">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-stone-100">
        <h1 className="font-display text-2xl font-extrabold text-brand-brown">Stop offers emails?</h1>
        <p className="mt-2 text-sm text-stone-600">You&apos;ll still get emails about your orders and account. You can join offers again any time from your profile.</p>
        <UnsubscribeButton profileId={u} token={t} />
      </div>
    </section>
  );
}
