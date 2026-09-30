"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * A signed-in page can reappear from the browser's back/forward cache after
 * someone else signed in (or everyone signed out) on this device — pressing
 * Back on the POS showed the admin panel without a password. Whenever the
 * session no longer belongs to the user this page was rendered for, reload
 * so the server decides what may be shown. Only UX: the server's role checks
 * never trusted this page anyway.
 */
export default function SessionGuard({ userId }: { userId: string }) {
  useEffect(() => {
    const supabase = createClient();
    const check = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) return; // offline / refresh hiccup — the next server request decides
      if (session?.user.id !== userId) window.location.replace(session ? window.location.href : "/auth/login");
    };
    check();
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) check(); };
    window.addEventListener("pageshow", onPageShow);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== userId) check();
    });
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      subscription.unsubscribe();
    };
  }, [userId]);
  return null;
}
