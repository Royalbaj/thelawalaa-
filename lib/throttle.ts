import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Rate limits for public forms that hold across every server instance (an
// in-memory counter resets with each serverless instance): every try is a row
// in email_throttle — the table started with the account emails, `kind` keeps
// the uses apart — keyed by a keyed hash of the IP or address, never the value.

function keyHash(value: string) {
  const secret = process.env.OTP_HMAC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "local-dev";
  return createHmac("sha256", `auth-email|${secret}`).update(value).digest("hex").slice(0, 32);
}

/** At most `max` of this kind per key in `minutes` (each key — the IP, the address — counts on its own). */
export async function throttled(kind: string, keys: string[], max: number, minutes = 60) {
  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  for (const key of keys) {
    const { count } = await supabaseAdmin.from("email_throttle").select("id", { count: "exact", head: true })
      .eq("kind", kind).eq("key_hash", keyHash(key)).gte("created_at", since);
    if ((count ?? 0) >= max) return true;
  }
  await supabaseAdmin.from("email_throttle").insert(keys.map((k) => ({ kind, key_hash: keyHash(k) })));
  return false;
}

/** The caller's IP — Vercel sets x-forwarded-for itself, so it can't be spoofed there. */
export const clientIp = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
