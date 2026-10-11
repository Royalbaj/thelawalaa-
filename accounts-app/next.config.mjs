import { fileURLToPath } from "node:url";

// Content-Security-Policy: only this site and the Supabase project (sign-in,
// bill uploads via signed URLs). Fonts are self-hosted by next/font. Bills open
// as a top-level redirect to a signed Supabase link, which CSP doesn't block.
const supabaseHost = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/^https?:\/\//, "");
const csp = [
  "default-src 'self'",
  // 'unsafe-eval' in dev only — React Refresh needs it.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://*.supabase.co",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Its own project inside the main repo — don't let Next treat the repo
  // root (which has its own lockfile) as this app's workspace root.
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false }, // type errors must fail the deploy
  // Going back to a tab within 30s shows it straight away (any save clears
  // this — every action calls revalidatePath).
  experimental: { staleTimes: { dynamic: 30 } },
  // The old Expenses and Orders pages became Entries (money in/out, typed in by hand).
  async redirects() {
    return [
      { source: "/expenses", destination: "/entries?kind=out", permanent: false },
      { source: "/orders/:path*", destination: "/", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // The money book is never for search engines.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
