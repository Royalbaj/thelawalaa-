"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Send, Star, CheckCircle2 } from "lucide-react";
import { submitFeedback } from "@/app/actions/feedback";
import { cn } from "@/lib/utils";

const LABELS = ["", "Terrible", "Not good", "Okay", "Good", "Loved it"];
const VISITS = [["dine_in", "Ate here"], ["pickup", "Picked up"], ["delivery", "Delivery"]] as const;

export default function FeedbackForm({ orderRef }: { orderRef?: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [visit, setVisit] = useState<string>("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  if (sent) {
    return (
      <div className="card p-8 text-center">
        <CheckCircle2 size={48} className="mx-auto text-brand-green" />
        <h2 className="mt-3 font-display text-2xl font-bold text-brand-brown">Thank you!</h2>
        <p className="mt-2 text-stone-600">We read every message — it helps us make Thelawalaa better.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/order" className="btn-primary">Order again</Link>
          <Link href="/" className="rounded-full border-2 border-stone-200 px-6 py-3 font-bold text-brand-brown hover:bg-stone-50">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <form className="card space-y-6 p-5 sm:p-8" onSubmit={(e) => {
      e.preventDefault();
      if (!rating) { toast.error("Tap the stars to say how it was"); return; }
      const fd = Object.fromEntries(new FormData(e.currentTarget));
      start(async () => {
        const r = await submitFeedback({ ...fd, rating, visit });
        if (r?.error) toast.error(r.error); else setSent(true);
      });
    }}>
      <fieldset>
        <legend className="font-display text-lg font-bold text-brand-brown">How was it?</legend>
        <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:gap-4" onMouseLeave={() => setHover(0)}>
          <div className="flex gap-1" role="radiogroup" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""} — ${LABELS[n]}`}
                onClick={() => setRating(n)} onMouseEnter={() => setHover(n)}
                className="rounded-lg p-1 transition active:scale-90">
                <Star size={40} strokeWidth={1.5}
                  className={cn("transition", n <= (hover || rating) ? "fill-amber-400 text-amber-400" : "fill-transparent text-stone-300")} />
              </button>
            ))}
          </div>
          <span className={cn("min-h-6 text-sm font-bold", hover || rating ? "text-brand-brown" : "text-stone-400")}>
            {LABELS[hover || rating] || "Tap to rate"}
          </span>
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">How did you get your food? <span className="font-normal text-stone-400">(optional)</span></legend>
        <div className="flex flex-wrap gap-2">
          {VISITS.map(([v, label]) => (
            <button key={v} type="button" onClick={() => setVisit(visit === v ? "" : v)} aria-pressed={visit === v}
              className={cn("rounded-full px-4 py-2 text-sm font-bold ring-1 transition",
                visit === v ? "bg-brand-brown text-white ring-brand-brown" : "bg-white text-stone-600 ring-stone-200")}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="label">Tell us more <span className="font-normal text-stone-400">(optional)</span></span>
        <textarea name="comment" rows={4} maxLength={1000} className="input"
          placeholder={rating && rating <= 2 ? "Sorry about that — what went wrong?" : "What did you like? What could be better?"} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Your name <span className="font-normal text-stone-400">(optional)</span></span>
          <input name="name" maxLength={80} className="input" autoComplete="name" />
        </label>
        <label className="block">
          <span className="label">Phone or email <span className="font-normal text-stone-400">(if you&apos;d like a reply)</span></span>
          <input name="contact" maxLength={80} className="input" autoComplete="tel" />
        </label>
      </div>
      <label className="block">
        <span className="label">Order number <span className="font-normal text-stone-400">(optional)</span></span>
        <input name="order_ref" maxLength={30} defaultValue={orderRef} placeholder="e.g. TW-1002-0015" className="input" />
      </label>
      {/* Honeypot: hidden from people, irresistible to bots */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      <button disabled={pending} className="btn-primary w-full text-lg">
        <Send size={18} /> {pending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
