"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getPosRoleStamp } from "@/app/actions/time-clock";
import { REFRESH_EVENT } from "@/components/refresh-button";

/**
 * Keeps the header in step with Admin → POS team & roles: every minute, when
 * the app comes to the front and on Refresh it asks the server what the
 * person on the till may do now; if that changed (a new role, more features,
 * switched off) the page data is fetched again — the cart is kept.
 */
export default function PosRoleWatch({ stamp }: { stamp: string }) {
  const router = useRouter();
  const drawn = useRef(stamp);
  useEffect(() => { drawn.current = stamp; }, [stamp]);
  useEffect(() => {
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const now = await getPosRoleStamp();
        if (now !== drawn.current) router.refresh();
      } catch { /* offline — try again next time */ } finally { busy = false; }
    };
    const t = setInterval(check, 60_000);
    const onShow = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener(REFRESH_EVENT, check);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onShow); window.removeEventListener(REFRESH_EVENT, check); };
  }, [router]);
  return null;
}
