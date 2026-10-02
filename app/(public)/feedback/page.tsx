import type { Metadata } from "next";
import FeedbackForm from "@/components/feedback-form";

export const metadata: Metadata = {
  title: "Feedback",
  description: "Tell Thelawalaa how your chatpate or momo was — we read every message.",
  alternates: { canonical: "/feedback" },
};

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  // ?order=… comes from the order-tracking page; only keep something that looks like an order number.
  const orderRef = order && /^[A-Za-z0-9-]{4,30}$/.test(order) ? order : undefined;
  return (
    <section className="bg-brand-cream px-4 py-10 md:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-orange">Feedback</p>
          <h1 className="font-display text-3xl font-extrabold text-brand-brown md:text-4xl">How was your food?</h1>
          <p className="mt-3 text-stone-600">Good or bad, we want to hear it. It takes 20 seconds.</p>
        </div>
        <FeedbackForm orderRef={orderRef} />
      </div>
    </section>
  );
}
