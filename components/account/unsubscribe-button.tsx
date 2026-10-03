"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { unsubscribeByLink } from "@/app/actions/customer";

export default function UnsubscribeButton({ profileId, token }: { profileId: string; token: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "done" | string>("idle");
  if (state === "done") {
    return (
      <div className="mt-6 space-y-3">
        <p className="flex items-center justify-center gap-2 font-bold text-brand-green"><CheckCircle2 size={18} /> You won&apos;t get offers emails any more.</p>
        <Link href="/" className="text-sm font-bold text-brand-orange">Back to the website →</Link>
      </div>
    );
  }
  return (
    <div className="mt-6">
      <button disabled={pending} onClick={() => start(async () => {
        const r = await unsubscribeByLink(profileId, token);
        setState("error" in r && r.error ? r.error : "done");
      })} className="btn-primary w-full">{pending ? "Unsubscribing…" : "Unsubscribe"}</button>
      {state !== "idle" && <p role="alert" className="mt-3 text-sm font-bold text-brand-red">{state}</p>}
    </div>
  );
}
