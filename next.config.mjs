/** @type {import('next').NextConfig} */

// Content-Security-Policy: locked to what the app actually uses.
// Google Maps embeds/places, Supabase REST + Realtime (wss).
const supabaseHost = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
  .replace(/^https?:\/\//, "");

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://maps.googleapis.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `img-src 'self' data: blob: https://*.supabase.co https://maps.gstatic.com https://maps.googleapis.com`,
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://maps.googleapis.com`,
  "frame-src https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
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
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
