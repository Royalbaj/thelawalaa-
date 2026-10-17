"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Send, Star, CheckCircle2, ThumbsUp, ThumbsDown } from "lucide-react";
import { submitFeedback } from "@/app/actions/feedback";
import { ASPECTS, BAD_TAGS, GOOD_TAGS, RATING_LABELS, VISITS, type AspectKey } from "@/lib/feedback";
import { cn } from "@/lib/utils";

/** Five stars as radio buttons — big for the overall rating, small for a detail. */
function StarPicker({ value, onChange, size, label }: { value: number; onChange: (n: number) => void; size: number; label: string }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5" role="radiogroup" aria-label={label} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} of 5 — ${RATING_LABELS[n]}`}
          onClick={() => onChange(value === n && size < 30 ? 0 : n)} onMouseEnter={() => setHover(n)}
          className="rounded-lg p-0.5 transition active:scale-90">
          <Star size={size} strokeWidth={1.5}
            className={cn("transition", n <= (hover || value) ? "fill-amber-400 text-amber-400" : "fill-transparent text-stone-300 dark:text-stone-600")} />
        </button>
      ))}
    </div>
  );
}

const chip = (on: boolean) => cn("rounded-full px-3.5 py-2 text-sm font-bold ring-1 transition active:scale-95",
  on ? "bg-brand-brown text-white ring-brand-brown dark:bg-orange-500 dark:ring-orange-500"
    : "bg-white text-stone-600 ring-stone-200 hover:bg-stone-50 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700");

/**
 * /feedback: the overall stars first (the one thing we need), then a few
 * taps — what stood out, the details, would they recommend us — and words
 * only if they want. The quick tags change with the stars.
 */
export default function FeedbackForm({ orderRef }: { orderRef?: string }) {
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [aspects, setAspects] = useState<Partial<Record<AspectKey, number>>>({});
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [visit, setVisit] = useState<string>("");
  const [wantsReply, setWantsReply] = useState(false);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  if (sent) {
    return (
      <div className="card p-8 text-center">
        <CheckCircle2 size={48} className="mx-auto text-brand-green" />
        <h2 className="mt-3 font-display text-2xl font-bold text-brand-brown dark:text-orange-50">Thank you!</h2>
        <p className="mt-2 text-stone-600 dark:text-stone-300">
          We read every message — it helps us make Thelawalaa better.{wantsReply ? " We'll get back to you soon." : ""}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/order" className="btn-primary">Order again</Link>
          <Link href="/" className="rounded-full border-2 border-stone-200 px-6 py-3 font-bold text-brand-brown hover:bg-stone-50 dark:border-stone-700 dark:text-orange-50 dark:hover:bg-stone-800">Back to home</Link>
        </div>
      </div>
    );
  }

  // Happy (4–5): what was good. Unhappy (1–2): what went wrong. In between: both.
  const tagChoices = rating >= 4 ? GOOD_TAGS : rating > 0 && rating <= 2 ? BAD_TAGS : [...GOOD_TAGS, ...BAD_TAGS];
  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const pickRating = (n: number) => {
    setRating(n);
    // Tags that no longer fit the stars (a "Tasty" after dropping to 1 star) go.
    const fits: readonly string[] = n >= 4 ? GOOD_TAGS : n <= 2 ? BAD_TAGS : [...GOOD_TAGS, ...BAD_TAGS];
    setTags((cur) => cur.filter((t) => fits.includes(t)));
  };

  return (
    <form className="card space-y-7 p-5 sm:p-8" onSubmit={(e) => {
      e.preventDefault();
      if (!rating) { toast.error("Tap the stars to say how it was"); return; }
      const fd = Object.fromEntries(new FormData(e.currentTarget));
      start(async () => {
        const r = await submitFeedback({ ...fd, rating, visit, tags, aspects, recommend: recommend ?? undefined, wants_reply: wantsReply });
        if (r?.error) toast.error(r.error); else setSent(true);
      });
    }}>
      {/* 1 — the overall stars */}
      <fieldset className="text-center">
        {/* The page's heading already asks "How was your food?" — the stars come straight after. */}
        <legend className="sr-only">Your rating</legend>
        <div className="flex flex-col items-center gap-1.5">
          <StarPicker value={rating} onChange={pickRating} size={44} label="Your rating" />
          <span className={cn("min-h-6 text-sm font-bold", rating ? "text-brand-brown dark:text-orange-50" : "text-stone-400")}>
            {RATING_LABELS[rating] || "Tap a star"}
          </span>
        </div>
      </fieldset>

      {rating > 0 && <>
        {/* 2 — what stood out */}
        <fieldset>
          <legend className="label">{rating >= 4 ? "What did you like?" : rating <= 2 ? "What went wrong?" : "What stood out?"} <span className="font-normal text-stone-400">(tap any)</span></legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {tagChoices.map((t) => (
              <button key={t} type="button" aria-pressed={tags.includes(t)} onClick={() => toggleTag(t)} className={chip(tags.includes(t))}>{t}</button>
            ))}
          </div>
        </fieldset>

        {/* 3 — the details, each on its own */}
        <fieldset>
          <legend className="label">Rate the details <span className="font-normal text-stone-400">(optional)</span></legend>
          <div className="mt-1 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {ASPECTS.map((a) => (
              <div key={a.key} className="flex items-center justify-between gap-3 rounded-xl bg-stone-50 px-3 py-1.5 dark:bg-stone-800/60">
                <span className="text-sm font-bold text-stone-700 dark:text-stone-200">{a.label}</span>
                <StarPicker value={aspects[a.key] ?? 0} size={22} label={a.label}
                  onChange={(n) => setAspects((cur) => ({ ...cur, [a.key]: n || undefined }))} />
              </div>
            ))}
          </div>
        </fieldset>

        {/* 4 — recommend + how they got it */}
        <div className="grid gap-6 sm:grid-cols-2">
          <fieldset>
            <legend className="label">Would you recommend us to a friend?</legend>
            <div className="mt-1 flex gap-2">
              <button type="button" aria-pressed={recommend === true} onClick={() => setRecommend(recommend === true ? null : true)} className={cn(chip(recommend === true), "flex items-center gap-1.5")}>
                <ThumbsUp size={15} aria-hidden /> Yes
              </button>
              <button type="button" aria-pressed={recommend === false} onClick={() => setRecommend(recommend === false ? null : false)} className={cn(chip(recommend === false), "flex items-center gap-1.5")}>
                <ThumbsDown size={15} aria-hidden /> Not yet
              </button>
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">How did you get your food? <span className="font-normal text-stone-400">(optional)</span></legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {VISITS.map(([v, label]) => (
                <button key={v} type="button" onClick={() => setVisit(visit === v ? "" : v)} aria-pressed={visit === v} className={chip(visit === v)}>{label}</button>
              ))}
            </div>
          </fieldset>
        </div>

        {/* 5 — words, only if they want */}
        <label className="block">
          <span className="label">Tell us more <span className="font-normal text-stone-400">(optional)</span></span>
          <textarea name="comment" rows={4} maxLength={1000} className="input"
            placeholder={rating <= 2 ? "Sorry about that — what happened? We'll put it right." : "Anything we should keep doing, or do better?"} />
        </label>

        <div className="space-y-4 rounded-2xl bg-stone-50 p-4 dark:bg-stone-800/50">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={wantsReply} onChange={(e) => setWantsReply(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#f97316]" />
            <span className="text-sm">
              <b className="text-stone-800 dark:text-stone-100">Please get back to me</b>
              <span className="block text-stone-500 dark:text-stone-400">The shop will call or message you about this.</span>
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">Your name <span className="font-normal text-stone-400">(optional)</span></span>
              <input name="name" maxLength={80} className="input" autoComplete="name" />
            </label>
            <label className="block">
              <span className="label">Phone or email {wantsReply ? <span className="text-brand-red">*</span> : <span className="font-normal text-stone-400">(optional)</span>}</span>
              <input name="contact" maxLength={80} className="input" autoComplete="tel" required={wantsReply} />
            </label>
          </div>
          <label className="block">
            <span className="label">Order number <span className="font-normal text-stone-400">(optional)</span></span>
            <input name="order_ref" maxLength={30} defaultValue={orderRef} placeholder="e.g. TW-1002-0015" className="input" />
          </label>
        </div>
      </>}
      {/* Honeypot: hidden from people, irresistible to bots */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      <button disabled={pending || !rating} className="btn-primary w-full text-lg">
        <Send size={18} /> {pending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
