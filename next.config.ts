import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // metascraper's transitive url-regex-safe → re2 native module can't be
  // bundled by Turbopack. Marking metascraper as server-external keeps the
  // SEO scraper route working without dragging the .node binary through
  // the server bundler.
  serverExternalPackages: [
    "metascraper",
    "metascraper-title",
    "metascraper-description",
    "metascraper-image",
    "metascraper-url",
    "url-regex-safe",
    "re2",
  ],
  async redirects() {
    return [
      { source: "/docu-design", destination: "/design-studio", permanent: true },
      { source: "/docu-design/:path*", destination: "/design-studio/:path*", permanent: true },
    ];
  },
  // Same-origin rewrite into the locally-running OpenCut sub-server so
  // /production-studio/timeline can iframe a proper editor instead of
  // pointing at the public opencut.app host. OPENCUT_URL defaults to the
  // local Vite dev server (apps/opencut/apps/web on :5173 — start it via
  // `npm run dev:opencut`). In production, set OPENCUT_URL to whatever
  // host serves the vendored OpenCut build.
  async rewrites() {
    // OpenCut runs under Vite with base="/embed/opencut/" (set via the
    // dev:opencut npm script + a matching build:opencut). The proxy
    // preserves the prefix so Vite's emitted asset paths resolve via
    // the same Next origin.
    const target = (process.env.OPENCUT_URL || "http://localhost:5173").replace(/\/$/, "");
    return [
      { source: "/embed/opencut", destination: `${target}/embed/opencut/` },
      { source: "/embed/opencut/:path*", destination: `${target}/embed/opencut/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/test/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
