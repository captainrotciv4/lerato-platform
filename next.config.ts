import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "leratofoundation.org" },
      { protocol: "https", hostname: "uploads.leratofoundation.org" },
    ],
  },
};

export default nextConfig;
