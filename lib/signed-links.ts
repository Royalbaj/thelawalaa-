import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// "Unsubscribe" links in offers emails work without signing in (shared
// phones, old emails): the link carries the profile id and a signature only
// the server can make, so nobody can unsubscribe someone else by guessing.

function sign(payload: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("No secret for signed links");
  return createHmac("sha256", `unsubscribe-link-v1|${secret ?? "local-dev-only"}`).update(payload).digest("base64url");
}

export const unsubscribeToken = (profileId: string) => sign(profileId);

export function verifyUnsubscribeToken(profileId: string, token: string) {
  const a = Buffer.from(sign(profileId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
