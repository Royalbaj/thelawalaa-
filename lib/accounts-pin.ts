import "server-only";
import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";

// PINs for the people who use the Accounts app (account_users, migration 024).
// Copy of accounts-app/lib/pin.ts, which checks them — change both.

export const isPin = (s: unknown): s is string => typeof s === "string" && /^\d{4}$/.test(s);

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32, { N: 16384, r: 8, p: 1 });
  return ["scrypt", 16384, 8, 1, salt.toString("base64"), hash.toString("base64")].join("$");
}

export function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return Promise.resolve(false);
  const expected = Buffer.from(hash, "base64");
  return new Promise((resolve) => {
    scrypt(pin, Buffer.from(salt, "base64"), expected.length, { N: Number(N), r: Number(r), p: Number(p) }, (err, actual) => {
      resolve(!err && actual.length === expected.length && timingSafeEqual(actual, expected));
    });
  });
}
