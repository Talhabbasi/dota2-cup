import type { NextConfig } from "next";

function s3PublicHostname(): string | null {
  const base = process.env.AWS_S3_PUBLIC_BASE_URL?.trim();
  if (!base) return null;
  try {
    return new URL(base).hostname;
  } catch {
    return null;
  }
}

const s3CdnHost = s3PublicHostname();

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    serverActions: {
      // Admin scoreboard uploads (OCR ingest).
      bodySizeLimit: "12mb",
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
      // Match screenshots on S3 (virtual-hosted + path-style / regional).
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.s3.*.amazonaws.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "s3.*.amazonaws.com",
        pathname: "/**",
      },
      ...(s3CdnHost
        ? [
            {
              protocol: "https" as const,
              hostname: s3CdnHost,
              pathname: "/**",
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
