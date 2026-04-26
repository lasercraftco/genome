import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
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
