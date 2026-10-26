import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Test builds set NEXT_DIST_DIR (e.g. .next-e2e) so they never overwrite the build a running server is using.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Dev only: lets the dev server be opened through an ngrok tunnel. Without it Next rejects the tunnel's dev
  // requests (HMR WebSocket returns 503), which can leave pages half-working. Has no effect in production builds.
  allowedDevOrigins: ["comprised-wilder-hungrily.ngrok-free.dev"],
  images: {
    formats: ["image/avif", "image/webp"],
    localPatterns: [{ pathname: "/media/**" }, { pathname: "/brand/**" }, { pathname: "/**" }],
  },
  serverExternalPackages: ["sharp"],
  experimental: {
    // The shared host caps threads/processes (build crashed with EAGAIN "can't spawn worker thread" at 61 workers),
    // so keep the build's worker pool small. Slightly slower builds, but they finish.
    cpus: 2,
    // Admin video uploads (up to 20 MB) pass through the proxy, which buffers request bodies up to this size.
    proxyClientMaxBodySize: "22mb",
    serverActions: { bodySizeLimit: "6mb" },
    // Next keeps prefetched static pages in the visitor's browser for 5 minutes by default, so a visitor who is
    // already browsing keeps seeing old content after an admin edit (the server has long since revalidated).
    // 30s is the minimum Next allows for static pages (dynamic pages are not cached at all). A tab that comes back
    // into view also refreshes itself, see RefreshOnFocus.
    staleTimes: { dynamic: 0, static: 30 },
  },
  async redirects() {
    // The standalone Work page was folded into the homepage "Our Work" slider.
    return [{ source: "/work", destination: "/#work", permanent: true }];
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          ...(isProd
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
