"use client";
import { useEffect } from "react";
import { signOutTo } from "@/lib/sign-out";

export const POS_SESSION_HOURS = 24;

/**
 * The POS (an iPad home-screen app) stays signed in for 24 hours after a
 * sign-in — closing the app or the iPad sleeping doesn't sign it out. After
 * that, the next time the app is opened or brought back to the front it asks
 * for the password again. Never while it's in use, so an order being taken
 * is never interrupted.
 */
export default function PosSession({ signedInAt }: { signedInAt: string | null }) {
  useEffect(() => {
    if (!signedInAt) return;
    const expired = () => Date.now() - Date.parse(signedInAt) > POS_SESSION_HOURS * 3600_000;
    const check = () => { if (document.visibilityState === "visible" && expired()) signOutTo("/auth/login?redirect=/admin&daily=1"); };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [signedInAt]);
  return null;
}
