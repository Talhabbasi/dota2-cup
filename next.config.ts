import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  images: {
    // Hobby image-optimization quota is exhausted (402 on /_next/image).
    // Serve originals from /public and the Steam CDN instead.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.cloudflare.steamstatic.com",
        pathname: "/apps/dota2/images/**",
      },
      {
        protocol: "https",
        hostname: "cdn.cloudflare.steamstatic.com",
        pathname: "/apps/dota2/videos/**",
      },
      {
        protocol: "https",
        hostname: "cdn.dota2.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.cloudflare.steamstatic.com",
        pathname: "/steam/apps/**",
      },
    ],
  },
};

export default nextConfig;
