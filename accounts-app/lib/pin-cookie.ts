// After signing in, the Accounts app asks for a person's PIN. Unlocking sets
// this httpOnly cookie: expiry + the person (account_users.id) + an HMAC over
// (login user id, person, expiry) — so it only works for the login that
// unlocked, names who is at the keyboard, and can't be forged or extended.
// Web Crypto only — the same code runs in middleware (edge) and on the server.

export const PIN_COOKIE = "acct_unlock";
export const PIN_TTL_SECONDS = 12 * 60 * 60;

async function key() {
  const secret = process.env.ACCOUNTS_PIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new Error("No secret for the Accounts PIN cookie");
  }
  return crypto.subtle.importKey(
    "raw", new TextEncoder().encode(`accounts-pin-cookie-v2|${secret ?? "local-dev-only"}`),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  );
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const UUID = /^[0-9a-f-]{36}$/;

export async function signUnlock(userId: string, personId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + PIN_TTL_SECONDS;
  const sig = await crypto.subtle.sign("HMAC", await key(), new TextEncoder().encode(`${userId}.${personId}.${exp}`));
  return `${exp}.${personId}.${b64url(new Uint8Array(sig))}`;
}

/** The person named in the cookie, NOT yet verified — only to start looking them up early. */
export function peekPerson(value: string | undefined): string | null {
  const person = value?.split(".")[1];
  return person && UUID.test(person) ? person : null;
}

/** The person who unlocked, if the cookie is genuine, unexpired and belongs to this login. */
export async function verifyUnlock(userId: string, value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const [expStr, person, sig] = value.split(".");
  const exp = Number(expStr);
  if (!sig || !person || !UUID.test(person) || !Number.isInteger(exp) || exp < Date.now() / 1000) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), fromB64url(sig), new TextEncoder().encode(`${userId}.${person}.${exp}`));
    return ok ? person : null;
  } catch {
    return null;
  }
}
