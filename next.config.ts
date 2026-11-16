import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: "500mb",
  },
  async rewrites() {
    const backendUrl = (process.env.XFILE_BACKEND_URL || "http://localhost:3000").replace(/\/$/, "");
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
