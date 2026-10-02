// After signing in, the Accounts app also asks for a PIN. Unlocking sets this
// httpOnly cookie: an expiry plus an HMAC over (user id, expiry), so it only
// works for the account that unlocked, and can't be forged or extended.
// Web Crypto only — the same code runs in middleware (edge) and on the server.

export const PIN_COOKIE = "acct_unlock";
export const PIN_TTL_SECONDS = 12 * 60 * 60;

async function key() {
  const secret = process.env.ACCOUNTS_PIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new Error("No secret for the Accounts PIN cookie");
  }
  return crypto.subtle.importKey(
    "raw", new TextEncoder().encode(`accounts-pin-cookie-v1|${secret ?? "local-dev-only"}`),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"],
  );
}

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export async function signUnlock(userId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + PIN_TTL_SECONDS;
  const sig = await crypto.subtle.sign("HMAC", await key(), new TextEncoder().encode(`${userId}.${exp}`));
  return `${exp}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyUnlock(userId: string, value: string | undefined): Promise<boolean> {
  if (!value) return false;
  const [expStr, sig] = value.split(".");
  const exp = Number(expStr);
  if (!sig || !Number.isInteger(exp) || exp < Date.now() / 1000) return false;
  try {
    return await crypto.subtle.verify("HMAC", await key(), fromB64url(sig), new TextEncoder().encode(`${userId}.${exp}`));
  } catch {
    return false;
  }
}
