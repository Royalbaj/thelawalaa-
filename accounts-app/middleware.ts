import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PIN_COOKIE, verifyUnlock } from "@/lib/pin-cookie";

const ALLOWED_ROLES = ["super_admin", "accountant"];

// Two locks: a normal sign-in (super_admin / accountant only), then a
// person's PIN. /login needs neither, /pin needs only the sign-in.
//
// Speed: this runs at the edge near the user, far from the database
// (us-east-1). getClaims() checks the sign-in token's signature locally
// (the project signs with ES256, keys cached), and a valid unlock cookie —
// only ever issued after the full role check — skips the role lookup. So an
// unlocked user's click costs no extra round trips here. Every page and
// action still runs requireAuth() next to the database, which re-checks the
// account, role and person properly.
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const response = NextResponse.next({ request: { headers: request.headers } });
  // A refreshed Supabase session lands on `response` — carry it over when redirecting.
  const redirectTo = (url: URL) => {
    const r = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => response.cookies.set({ name, value, ...options }),
        remove: (name: string, options: CookieOptions) => response.cookies.set({ name, value: "", ...options }),
      },
    }
  );

  // Refreshes an expired session (writing the new cookies) and verifies the token.
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (pathname.startsWith("/login")) return response;
  if (!userId) return redirectTo(new URL("/login", request.url));

  const unlocked = await verifyUnlock(userId, request.cookies.get(PIN_COOKIE)?.value);
  if (unlocked && !pathname.startsWith("/pin")) return response;

  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", userId).single();
  if (!profile?.is_active || !ALLOWED_ROLES.includes(profile.role)) {
    return redirectTo(new URL("/login?error=forbidden", request.url));
  }
  if (pathname.startsWith("/pin")) return response;

  const url = new URL("/pin", request.url);
  if (pathname !== "/" && request.method === "GET") url.searchParams.set("next", pathname + search);
  return redirectTo(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
