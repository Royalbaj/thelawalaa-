// Server-component / server-action client bound to the user's cookies.
// Still anon key + RLS — acts AS the user, not above them.
import { cache } from "react";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PIN_COOKIE, peekPerson, verifyUnlock } from "@/lib/pin-cookie";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ALLOWED_ROLES = ["super_admin", "accountant"];

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        remove: (name: string, options: CookieOptions) => {
          try { cookieStore.set({ name, value: "", ...options }); } catch {}
        },
      },
    }
  );
}

/**
 * The only trusted way to identify the caller — verifies the JWT, then reads
 * role from the DB. cache(): the layout and the page share one check per request.
 */
export const getVerifiedUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, profile: null, supabase };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active || !ALLOWED_ROLES.includes(profile.role)) {
    return { user: null, profile: null, supabase };
  }
  return { user, profile, supabase };
});

/** Signed in with an allowed role — enough for the PIN screen, nothing else. Otherwise → /login. */
export async function requireSignedIn() {
  const ctx = await getVerifiedUser();
  if (!ctx.user || !ctx.profile) redirect("/login");
  return ctx as { user: NonNullable<typeof ctx.user>; profile: NonNullable<typeof ctx.profile>; supabase: typeof ctx.supabase };
}

export type Person = { id: string; name: string };

const getPerson = cache(async (id: string): Promise<Person | null> => {
  const { data } = await supabaseAdmin.from("account_users").select("id, name").eq("id", id).eq("is_active", true).maybeSingle();
  return data ?? null;
});

/**
 * Signed in AND unlocked with a person's PIN — every page, action and
 * download. Returns who is at the keyboard (`person`), whose name goes on
 * everything they enter. The person lookup runs alongside the sign-in check.
 */
export const requireAuth = cache(async () => {
  const unlock = (await cookies()).get(PIN_COOKIE)?.value;
  const peeked = peekPerson(unlock);
  const [ctx, person] = await Promise.all([requireSignedIn(), peeked ? getPerson(peeked) : null]);
  const verified = await verifyUnlock(ctx.user.id, unlock);
  // Locked (Lock button, idle timer, expired) or a person the admin switched off → the PIN
  // screen. A redirect, not an error: locking re-renders the page it happened on.
  if (!verified || !person || verified !== person.id) redirect("/pin");
  return { ...ctx, person };
});
