"use client";
import { useEffect } from "react";
import { unstable_isUnrecognizedActionError } from "next/navigation";

// Copy of the main site's components/version-guard.tsx — change both.
// After a deploy, a page that was already open still runs the OLD build: its
// buttons call server actions the new server doesn't know ("Failed to find
// Server Action"), so a sale, a notice or a refresh fails. Staff screens stay
// open all day (POS iPad, Admin, rider phones), so they check once a minute —
// and whenever they come back to the front — whether a newer build is live,
// and reload by themselves as soon as nobody is in the middle of something.

const MINE = process.env.NEXT_PUBLIC_APP_VERSION;

/** Someone's typing, a box is open, or a screen says not now (the POS while a cart is being built). */
function busy() {
  const a = document.activeElement as HTMLElement | null;
  if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable)) return true;
  return !!document.querySelector('[aria-modal="true"], [data-keep-page]');
}

export default function VersionGuard() {
  useEffect(() => {
    let stale = false;
    const reloadWhenIdle = () => { if (stale && !busy()) window.location.reload(); };
    const check = async () => {
      if (stale) { reloadWhenIdle(); return; }
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { v } = (await res.json()) as { v: string | null };
        if (v && MINE && v !== MINE) { stale = true; reloadWhenIdle(); }
      } catch { /* offline — try again later */ }
    };
    // An old button already failed: no need to wait for the next check.
    const onRejection = (e: PromiseRejectionEvent) => {
      if (unstable_isUnrecognizedActionError(e.reason)) { stale = true; reloadWhenIdle(); }
    };
    const onFront = () => { if (document.visibilityState === "visible") check(); };
    check();
    const poll = setInterval(check, 60_000);
    const idle = setInterval(reloadWhenIdle, 10_000);
    document.addEventListener("visibilitychange", onFront);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      clearInterval(poll); clearInterval(idle);
      document.removeEventListener("visibilitychange", onFront);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
