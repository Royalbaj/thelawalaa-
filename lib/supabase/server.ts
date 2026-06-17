// Server-component / server-action client bound to the user's cookies.
// Still anon key + RLS — acts AS the user, not above them.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();
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
 * The ONLY trusted way to identify the caller in server code.
 * supabase.auth.getUser() verifies the JWT against the Auth server —
 * unlike getSession(), which just decodes the cookie and can be spoofed.
 * Returns the verified user + their profile (role checked from DB, never JWT).
 */
export async function getVerifiedUser() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, profile: null, supabase };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone, is_active, branch_id, is_online")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) return { user: null, profile: null, supabase };
  return { user, profile, supabase };
}

/** Throws unless the verified caller has one of the allowed roles. */
export async function requireRole(roles: string[]) {
  const ctx = await getVerifiedUser();
  if (!ctx.profile || !roles.includes(ctx.profile.role)) {
    throw new Error("Forbidden");
  }
  return ctx as { user: NonNullable<typeof ctx.user>; profile: NonNullable<typeof ctx.profile>; supabase: typeof ctx.supabase };
}
