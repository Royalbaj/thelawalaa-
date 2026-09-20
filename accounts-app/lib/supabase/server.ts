// Server-component / server-action client bound to the user's cookies.
// Still anon key + RLS — acts AS the user, not above them.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const ALLOWED_ROLES = ["admin", "accountant"];

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

/** The only trusted way to identify the caller — verifies the JWT, then reads role from the DB. */
export async function getVerifiedUser() {
  const supabase = createClient();
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
}

export async function requireAuth() {
  const ctx = await getVerifiedUser();
  if (!ctx.user || !ctx.profile) throw new Error("Forbidden");
  return ctx as { user: NonNullable<typeof ctx.user>; profile: NonNullable<typeof ctx.profile>; supabase: typeof ctx.supabase };
}
