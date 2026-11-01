"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { unstable_isUnrecognizedActionError } from "next/navigation";
import { AlertTriangle } from "lucide-react";

// After a deploy, a page opened before it calls server actions the new build
// doesn't have — reload it once (a cart lives in the tab, so it survives) instead
// of showing an error. A second failure within a minute shows the error page.
const RELOADED = "tw-reloaded-for-update";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const message = String((error as Error | undefined)?.message ?? "");
  const update = /Server Action .* was not found on the server/.test(message) || unstable_isUnrecognizedActionError(error);
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    if (!update) return;
    let last = 0;
    try { last = Number(sessionStorage.getItem(RELOADED) ?? 0); } catch { /* storage blocked */ }
    if (Date.now() - last < 60_000) return;
    try { sessionStorage.setItem(RELOADED, String(Date.now())); } catch { /* storage blocked */ }
    setReloading(true);
    window.location.reload();
  }, [update]);

  if (reloading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
        <p className="font-display text-lg font-bold text-white">Getting the latest version…</p>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-dark px-4">
      <div className="card max-w-md p-8 text-center">
        <AlertTriangle size={40} className="mx-auto text-brand-red" />
        <h1 className="mt-3 font-display text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-stone-600">That page hit an unexpected error. Try again, or head back home.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button onClick={() => (update ? window.location.reload() : reset())} className="btn-outline !border-stone-300 !text-brand-brown hover:!bg-stone-100">Try again</button>
          <Link href="/" className="btn-primary">Go home</Link>
        </div>
      </div>
    </div>
  );
}
