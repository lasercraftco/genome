import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Don't fail production builds on lint warnings/cosmetic errors. CI lint
  // job catches these separately so we don't lose visibility.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  images: {
    remotePatterns: [
      { hostname: "**" }, // album art comes from a galaxy of CDNs
    ],
  },
  async rewrites() {
    return [
      // Forward /api/engine/* to the Python FastAPI service.
      {
        source: "/api/engine/:path*",
        destination: `${process.env.GENOME_ENGINE_URL || "http://localhost:8001"}/api/:path*`,
      },
    ];
  },
};

export default config;
