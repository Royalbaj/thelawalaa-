import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_ROLES = ["super_admin", "accountant"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
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

  if (pathname.startsWith("/login")) {
    await supabase.auth.getUser();
    return response;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).single();
  if (!profile?.is_active || !ALLOWED_ROLES.includes(profile.role)) {
    return NextResponse.redirect(new URL("/login?error=forbidden", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
