"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { playOrderSound, unlockOrderSound } from "@/lib/order-sound";

/**
 * Keeps the rider's screen current: Realtime (RLS lets a driver see only
 * their own deliveries and assigned orders) plus a 30-second re-check in
 * case an event is missed. A new delivery chimes once a tap has unlocked
 * sound (phones only allow sound after a tap).
 */
export default function DriverLive({ jobIds }: { jobIds: string[] }) {
  const router = useRouter();
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    const fresh = known.current ? jobIds.filter((id) => !known.current!.has(id)) : [];
    if (fresh.length && document.visibilityState === "visible") {
      playOrderSound();
      toast.success(fresh.length === 1 ? "New delivery for you" : `${fresh.length} new deliveries for you`, { icon: "🛵" });
    }
    known.current = new Set(jobIds);
  }, [jobIds]);

  useEffect(() => {
    const onTap = () => { unlockOrderSound(); };
    window.addEventListener("pointerdown", onTap, { capture: true });
    const supabase = createClient();
    const channel = supabase
      .channel("driver-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => router.refresh())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => router.refresh())
      .subscribe();
    const poll = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 30_000);
    const onShow = () => { if (document.visibilityState === "visible") router.refresh(); };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.removeEventListener("pointerdown", onTap, { capture: true });
      document.removeEventListener("visibilitychange", onShow);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
