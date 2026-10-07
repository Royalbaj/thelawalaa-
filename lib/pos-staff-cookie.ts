import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// POS staff login on the shared counter login: typing your PIN on the POS lock
// screen sets this httpOnly cookie naming the person (training_people.id),
// bound to the POS login that's signed in and signed with a key only the
// server has — so it can't be forged, moved to another login or extended.
// It lasts at most a working day (16 h); "Log out" on the till ends it sooner.
// Host-only, like every cookie here.

export const POS_STAFF_COOKIE = "tw_pos_staff";
export const POS_STAFF_TTL_SECONDS = 16 * 60 * 60;
const UUID = /^[0-9a-f-]{36}$/;

function sign(payload: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret && process.env.NODE_ENV === "production") throw new Error("No secret for the POS staff cookie");
  return createHmac("sha256", `pos-staff-cookie-v1|${secret ?? "local-dev-only"}`).update(payload).digest("base64url");
}

export function signPosStaff(userId: string, personId: string) {
  const exp = Math.floor(Date.now() / 1000) + POS_STAFF_TTL_SECONDS;
  return `${exp}.${personId}.${sign(`${userId}.${personId}.${exp}`)}`;
}

/** The person logged in on this POS device, if the cookie is genuine, unexpired and for this login. */
export function verifyPosStaff(userId: string, value: string | undefined): string | null {
  if (!value) return null;
  const [expStr, person, sig] = value.split(".");
  const exp = Number(expStr);
  if (!sig || !person || !UUID.test(person) || !Number.isInteger(exp) || exp < Date.now() / 1000) return null;
  const expected = Buffer.from(sign(`${userId}.${person}.${exp}`));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? person : null;
}

export const posStaffCookieOptions = {
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: POS_STAFF_TTL_SECONDS,
};
