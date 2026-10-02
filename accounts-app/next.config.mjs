import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Its own project inside the main repo — don't let Next treat the repo
  // root (which has its own lockfile) as this app's workspace root.
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false }, // type errors must fail the deploy
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
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
