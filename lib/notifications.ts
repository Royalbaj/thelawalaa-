import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Messages from the admin (Admin → Notifications, migration 029): offers for
// customers who joined offers, or news for delivery drivers. Shown in their
// portal; "unread" = newer than profiles.notifications_seen_at.

export type Notice = { id: string; title: string; body: string; link_url: string | null; created_at: string };

const WINDOW_DAYS = 30;

export async function getInbox(profileId: string, audience: "customers" | "drivers") {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString();
  const [{ data: rows }, { data: me }] = await Promise.all([
    supabaseAdmin.from("notifications").select("id, title, body, link_url, created_at")
      .eq("audience", audience).gte("created_at", since).order("created_at", { ascending: false }).limit(30),
    supabaseAdmin.from("profiles").select("notifications_seen_at, marketing_opt_in").eq("id", profileId).single(),
  ]);
  // Offers are only for customers who chose to join them.
  const allowed = audience === "drivers" || !!me?.marketing_opt_in;
  const items = allowed ? (rows ?? []) as Notice[] : [];
  const seen = me?.notifications_seen_at ? new Date(me.notifications_seen_at).getTime() : 0;
  return { items, unread: items.filter((n) => new Date(n.created_at).getTime() > seen).length, joined: !!me?.marketing_opt_in };
}

export async function unreadCount(profileId: string, audience: "customers" | "drivers") {
  return (await getInbox(profileId, audience)).unread;
}
