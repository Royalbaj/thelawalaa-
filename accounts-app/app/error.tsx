"use client";
import { useEffect, useState } from "react";
import { unstable_isUnrecognizedActionError } from "next/navigation";

// After a deploy, a page opened before it calls server actions the new build
// doesn't have — reload it once instead of showing an error (copy of the main
// site's app/error.tsx). A second failure within a minute shows the message.
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

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="card max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-bold text-brand-brown">{reloading ? "Getting the latest version…" : "Something went wrong"}</h1>
        {!reloading && (
          <>
            <p className="mt-2 text-sm text-stone-600">That page hit an unexpected error. Try again.</p>
            <button onClick={() => (update ? window.location.reload() : reset())} className="btn-primary mt-5">Try again</button>
          </>
        )}
      </div>
    </div>
  );
}
