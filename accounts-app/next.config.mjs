import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Its own project inside the main repo — don't let Next treat the repo
  // root (which has its own lockfile) as this app's workspace root.
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false }, // type errors must fail the deploy
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
