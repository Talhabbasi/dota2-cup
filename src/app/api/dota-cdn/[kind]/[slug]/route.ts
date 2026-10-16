import { NextResponse } from "next/server";

export const runtime = "nodejs";

const KIND_PATH: Record<string, (slug: string) => string[]> = {
  portrait: (slug) => [
    `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${slug}.png`,
    `https://cdn.akamai.steamstatic.com/apps/dota2/images/dota_react/heroes/${slug}.png`,
    `https://cdn.dota2.com/apps/dota2/images/dota_react/heroes/${slug}.png`,
  ],
  icon: (slug) => [
    `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/icons/${slug}.png`,
    `https://cdn.akamai.steamstatic.com/apps/dota2/images/dota_react/heroes/icons/${slug}.png`,
    `https://cdn.dota2.com/apps/dota2/images/dota_react/heroes/icons/${slug}.png`,
  ],
  render: (slug) => [
    `https://cdn.cloudflare.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders/${slug}.png`,
    `https://cdn.akamai.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders/${slug}.png`,
  ],
  item: (slug) => [
    `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${slug}.png`,
    `https://cdn.akamai.steamstatic.com/apps/dota2/images/dota_react/items/${slug}.png`,
    `https://cdn.dota2.com/apps/dota2/images/dota_react/items/${slug}.png`,
  ],
};

/** Steam CDN keys that differ from common / renamed hero names. */
const HERO_CDN_SLUG: Record<string, string> = {
  outworld_destroyer: "obsidian_destroyer",
  outworld_devourer: "obsidian_destroyer",
};

const SAFE_SLUG = /^[a-z0-9_-]+$/i;

const CACHE_HIT =
  "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400";

export async function GET(
  _request: Request,
  context: { params: Promise<{ kind: string; slug: string }> },
) {
  const { kind, slug: raw } = await context.params;
  const builders = KIND_PATH[kind];
  if (!builders || !SAFE_SLUG.test(raw)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const slug =
    kind === "item" ? raw.toLowerCase() : (HERO_CDN_SLUG[raw] ?? raw);

  for (const url of builders(slug)) {
    try {
      const upstream = await fetch(url, {
        // CDN art changes rarely; allow edge caching of successful fetches.
        next: { revalidate: 604800 },
        signal: AbortSignal.timeout(12_000),
      });
      if (!upstream.ok) continue;
      const contentType = upstream.headers.get("content-type") ?? "image/png";
      if (!contentType.startsWith("image/")) continue;
      const body = await upstream.arrayBuffer();
      if (body.byteLength < 64) continue;
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": CACHE_HIT,
        },
      });
    } catch {
      // try next host
    }
  }

  return new NextResponse("Asset unavailable", {
    status: 502,
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
