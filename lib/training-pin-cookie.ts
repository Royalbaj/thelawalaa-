import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Staff training on a shared device: entering your training PIN sets this
// httpOnly cookie naming the person (training_people.id), bound to the login
// that's signed in and signed with a key only the server has — so it can't be
// forged, moved to another login or extended. Short-lived: devices are shared.

export const TRAINEE_COOKIE = "tw_trainee";
export const TRAINEE_TTL_SECONDS = 3 * 60 * 60;
const UUID = /^[0-9a-f-]{36}$/;

function sign(payload: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("No secret for the training cookie");
  return createHmac("sha256", `training-pin-cookie-v1|${secret ?? "local-dev-only"}`).update(payload).digest("base64url");
}

export function signTrainee(userId: string, personId: string) {
  const exp = Math.floor(Date.now() / 1000) + TRAINEE_TTL_SECONDS;
  return `${exp}.${personId}.${sign(`${userId}.${personId}.${exp}`)}`;
}

/** The person who unlocked training on this login, if the cookie is genuine and unexpired. */
export function verifyTrainee(userId: string, value: string | undefined): string | null {
  if (!value) return null;
  const [expStr, person, sig] = value.split(".");
  const exp = Number(expStr);
  if (!sig || !person || !UUID.test(person) || !Number.isInteger(exp) || exp < Date.now() / 1000) return null;
  const expected = Buffer.from(sign(`${userId}.${person}.${exp}`));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? person : null;
}
