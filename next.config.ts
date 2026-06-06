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
