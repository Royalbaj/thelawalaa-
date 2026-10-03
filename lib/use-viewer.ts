"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Who is signed in on this device (just the role) — the top bar and the
// bottom bar both need it, so it's looked up once per page load. Signing in
// or out always does a full page load, which starts this afresh.
let pending: Promise<string | null> | null = null;

function loadRole() {
  pending ??= (async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    return (data?.role as string | undefined) ?? null;
  })().catch(() => null);
  return pending;
}

export function useViewerRole() {
  const [state, setState] = useState<{ role: string | null; ready: boolean }>({ role: null, ready: false });
  useEffect(() => {
    let live = true;
    loadRole().then((role) => { if (live) setState({ role, ready: true }); });
    return () => { live = false; };
  }, []);
  return state;
}
