"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { BellRing, CheckCircle2, Trophy } from "lucide-react";
import { setMarketingOptIn } from "@/app/actions/customer";
import { cn } from "@/lib/utils";

// Offers are opt-in only: nobody is joined automatically, they tap "Join".

/** The card on the account home: a big Join button, or a small "you're in". */
export function OffersJoinCard({ joined: initial }: { joined: boolean }) {
  const [joined, setJoined] = useState(initial);
  const [pending, start] = useTransition();
  const join = () => start(async () => {
    const r = await setMarketingOptIn(true);
    if ("error" in r && r.error) toast.error(r.error);
    else { setJoined(true); toast.success("You're in! New offers and competitions will reach you first."); }
  });

  if (joined) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-green-50 px-4 py-3 text-sm ring-1 ring-green-100">
        <CheckCircle2 size={18} className="shrink-0 text-brand-green" />
        <p className="min-w-0 flex-1 text-green-900"><b>You&apos;re in offers &amp; competitions.</b> New ones show up in your <Link href="/account/notifications" className="font-bold underline-offset-2 hover:underline">inbox</Link>.</p>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-brown via-[#8a3d12] to-brand-orange p-5 text-white shadow-lg shadow-orange-900/20 sm:p-6">
      <Trophy aria-hidden size={110} className="absolute -right-5 -top-4 text-white/10" />
      <p className="text-xs font-bold uppercase tracking-widest text-amber-200">Offers &amp; competitions</p>
      <p className="mt-1 font-display text-xl font-extrabold">Be first to hear about new deals</p>
      <p className="mt-1 max-w-md text-sm text-orange-50/90">Join to get new offers, member-only deals and competitions by email and in your inbox. It&apos;s your choice — leave any time from your profile.</p>
      <button disabled={pending} onClick={join}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand-brown shadow-sm transition hover:bg-orange-50 disabled:opacity-60">
        <BellRing size={16} /> {pending ? "Joining…" : "Join offers & competitions"}
      </button>
      <p className="mt-3 text-[11px] text-orange-100/80">Offers can change or end at any time. <Link href="/terms#offers" className="underline">Terms apply</Link>.</p>
    </div>
  );
}

/** Profile → Offers & competitions: a plain on/off switch. */
export function OffersToggle({ joined: initial }: { joined: boolean }) {
  const [joined, setJoined] = useState(initial);
  const [pending, start] = useTransition();
  const flip = () => start(async () => {
    const r = await setMarketingOptIn(!joined);
    if ("error" in r && r.error) toast.error(r.error);
    else { setJoined(!joined); toast.success(!joined ? "Joined — you'll hear about new offers" : "Done — no more offers messages"); }
  });
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-bold text-brand-brown">Offers, promotions &amp; competitions</p>
        <p className="text-xs text-stone-500">{joined ? "You get new offers by email and in your inbox." : "You don't get offers messages. Order and account emails still come."}</p>
      </div>
      <button role="switch" aria-checked={joined} aria-label="Offers, promotions and competitions" disabled={pending} onClick={flip}
        className={cn("relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-60", joined ? "bg-brand-green" : "bg-stone-300")}>
        <span className={cn("absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all", joined ? "left-7" : "left-1")} />
      </button>
    </div>
  );
}
