import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// First-match wins, so list the most specific prefixes first.
// /track is deliberately NOT here — guest checkouts have no account, so
// order tracking is a public direct-link page (unguessable UUID in the
// URL = the capability). Access to the actual row is still enforced by
// orders RLS, not by this middleware.
const ROLE_ROUTES: [string, string[]][] = [
  ["/admin", ["admin", "pos_user"]],
  ["/pos", ["admin", "pos_user"]],
  ["/delivery", ["admin", "delivery_driver"]],
  ["/staff", ["admin", "pos_user", "delivery_driver"]],
  ["/account", ["admin", "pos_user", "delivery_driver", "customer"]],
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Super Admin and Admin are one tier now — keep old /super-admin links working.
  if (pathname === "/super-admin" || pathname.startsWith("/super-admin/")) {
    const target = new URL(pathname.replace(/^\/super-admin/, "/admin") || "/admin", request.url);
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target);
  }

  const response = NextResponse.next({ request: { headers: request.headers } });

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

  const matched = ROLE_ROUTES.find(([route]) => pathname.startsWith(route));
  if (!matched) {
    // Public route — still refresh the session cookie if present.
    await supabase.auth.getUser();
    return response;
  }

  // SECURITY: getUser() validates the JWT with the Auth server.
  // getSession() only decodes the cookie and MUST NOT be used for authz.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role always read from the DB (RLS lets a user read only their own row),
  // never trusted from JWT claims or client state.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile?.is_active) {
    return NextResponse.redirect(new URL("/auth/suspended", request.url));
  }
  if (!matched[1].includes(profile.role)) {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }
  return response;
}

export const config = {
  matcher: [
    "/super-admin/:path*", "/admin/:path*", "/pos/:path*", "/delivery/:path*", "/staff/:path*",
    "/account/:path*", "/order/:path*", "/track/:path*",
  ],
};

