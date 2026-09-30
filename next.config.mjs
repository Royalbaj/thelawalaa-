/** @type {import('next').NextConfig} */

// Content-Security-Policy: locked to what the app actually uses.
// Google Maps embeds/places, Supabase REST + Realtime (wss).
const supabaseHost = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
  .replace(/^https?:\/\//, "");

const csp = [
  "default-src 'self'",
  // 'unsafe-eval' in dev only — React Refresh needs it; without it local pages never hydrate.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://maps.googleapis.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `img-src 'self' data: blob: https://*.supabase.co https://maps.gstatic.com https://maps.googleapis.com https://images.unsplash.com`,
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://maps.googleapis.com`,
  "frame-src https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://rc-epay.esewa.com.np https://epay.esewa.com.np",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig = {
  poweredByHeader: false, // don't advertise the framework
  images: {
    // Keep in sync with img-src in the CSP above — legacy seed data
    // (supabase/migrations/004_legacy_update_images.sql) still points some
    // products at Unsplash, which 400s through /_next/image if not listed.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type errors must fail the deploy — Next 15's async params/searchParams
    // are only type-checked here, never by a plain `tsc`.
    ignoreBuildErrors: false,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
