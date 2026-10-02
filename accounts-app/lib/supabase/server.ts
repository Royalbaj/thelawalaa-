// Server-component / server-action client bound to the user's cookies.
// Still anon key + RLS — acts AS the user, not above them.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { PIN_COOKIE, verifyUnlock } from "@/lib/pin-cookie";

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

/** The only trusted way to identify the caller — verifies the JWT, then reads role from the DB. */
export async function getVerifiedUser() {
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
}

/** Signed in with an allowed role — enough for the PIN screen, nothing else. */
export async function requireSignedIn() {
  const ctx = await getVerifiedUser();
  if (!ctx.user || !ctx.profile) throw new Error("Forbidden");
  return ctx as { user: NonNullable<typeof ctx.user>; profile: NonNullable<typeof ctx.profile>; supabase: typeof ctx.supabase };
}

/** Signed in AND unlocked with the PIN — every page, action and download. */
export async function requireAuth() {
  const ctx = await requireSignedIn();
  if (!(await verifyUnlock(ctx.user.id, (await cookies()).get(PIN_COOKIE)?.value))) throw new Error("Locked");
  return ctx;
}
