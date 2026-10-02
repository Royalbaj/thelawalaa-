import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { PIN_COOKIE, verifyUnlock } from "@/lib/pin-cookie";

const ALLOWED_ROLES = ["super_admin", "accountant"];

// Two locks: a normal sign-in (super_admin / accountant only), then the
// Accounts PIN. /login needs neither, /pin needs only the sign-in.
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

  if (pathname.startsWith("/login")) {
    await supabase.auth.getUser();
    return response;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectTo(new URL("/login", request.url));

  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).single();
  if (!profile?.is_active || !ALLOWED_ROLES.includes(profile.role)) {
    return redirectTo(new URL("/login?error=forbidden", request.url));
  }

  if (pathname.startsWith("/pin")) return response;
  if (!(await verifyUnlock(user.id, request.cookies.get(PIN_COOKIE)?.value))) {
    const url = new URL("/pin", request.url);
    if (pathname !== "/" && request.method === "GET") url.searchParams.set("next", pathname + search);
    return redirectTo(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
