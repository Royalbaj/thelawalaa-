import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// The Accounts PIN is stored only as a scrypt hash (account_settings.pin_hash):
// "scrypt$N$r$p$salt$hash", base64 parts.

export const isPin = (s: unknown): s is string => typeof s === "string" && /^\d{4}$/.test(s);

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32, { N: 16384, r: 8, p: 1 });
  return ["scrypt", 16384, 8, 1, salt.toString("base64"), hash.toString("base64")].join("$");
}

export function verifyPin(pin: string, stored: string): boolean {
  const [scheme, N, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = scryptSync(pin, Buffer.from(salt, "base64"), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
