export type OpenDotaMatchPlayer = {
  account_id?: number;
  personaname?: string;
  hero_id: number;
  player_slot: number;
  kills: number;
  deaths: number;
  assists: number;
  last_hits: number;
  denies: number;
  gold_per_min: number;
  xp_per_min: number;
  item_0: number;
  item_1: number;
  item_2: number;
  item_3: number;
  item_4: number;
  item_5: number;
};

export type OpenDotaMatch = {
  match_id: number;
  duration: number;
  start_time: number;
  radiant_win: boolean;
  players?: OpenDotaMatchPlayer[];
};

export type HeroInfo = {
  id: number;
  slug: string;
  name: string;
  primaryAttr?: string;
  attackType?: string;
  roles?: string[];
};

export type ItemInfo = {
  id: number;
  key: string;
  name: string;
};

type HeroConst = {
  id: number;
  name: string;
  localized_name: string;
};

type ItemConst = {
  id: number;
  img?: string;
  dname?: string;
};

let heroListCache: HeroInfo[] | null = null;
let heroByIdCache: Record<number, HeroInfo> | null = null;
let itemByIdCache: Record<number, ItemInfo> | null = null;

function heroSlug(npcName: string): string {
  return npcName.replace(/^npc_dota_hero_/, "");
}

/** Steam CDN keys that differ from common / renamed hero names. */
const HERO_CDN_SLUG: Record<string, string> = {
  outworld_destroyer: "obsidian_destroyer",
  outworld_devourer: "obsidian_destroyer",
};

function cdnSlug(slug: string) {
  return HERO_CDN_SLUG[slug] ?? slug;
}

export function heroPortraitUrl(slug: string) {
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${cdnSlug(slug)}.png`;
}

export function heroRenderUrl(slug: string) {
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders/${cdnSlug(slug)}.png`;
}

export function heroIconUrl(slug: string): string {
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/icons/${cdnSlug(slug)}.png`;
}

export function itemIconUrl(key: string): string {
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${key}.png`;
}

function cacheHeroList(list: HeroInfo[]) {
  heroListCache = list;
  heroByIdCache = Object.fromEntries(list.map((h) => [h.id, h]));
  return list;
}

async function loadHeroCatalogFromDb(): Promise<HeroInfo[]> {
  const { prisma } = await import("./prisma");
  const rows = await prisma.hero.findMany({
    orderBy: { name: "asc" },
  });
  if (rows.length === 0) return [];
  return cacheHeroList(
    rows.map((h) => ({
      id: h.id,
      slug: h.slug,
      name: h.name,
      primaryAttr: h.primaryAttr,
      attackType: h.attackType,
      roles: JSON.parse(h.rolesJson) as string[],
    })),
  );
}

async function loadHeroCatalogFromApi(): Promise<HeroInfo[]> {
  const res = await fetch("https://api.opendota.com/api/constants/heroes", {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Record<string, HeroConst>;
  return cacheHeroList(
    Object.values(data)
      .map((h) => ({
        id: h.id,
        slug: heroSlug(h.name),
        name: h.localized_name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
}

export async function loadHeroCatalog(): Promise<HeroInfo[]> {
  if (heroListCache) return heroListCache;
  const fromDb = await loadHeroCatalogFromDb();
  if (fromDb.length > 0) return fromDb;
  return loadHeroCatalogFromApi();
}

export async function loadHeroById(): Promise<Record<number, HeroInfo>> {
  if (heroByIdCache) return heroByIdCache;
  await loadHeroCatalog();
  return heroByIdCache ?? {};
}

export async function loadHeroNames(): Promise<Record<number, string>> {
  const byId = await loadHeroById();
  return Object.fromEntries(
    Object.values(byId).map((h) => [h.id, h.name]),
  );
}

export async function loadItemCatalog(): Promise<Record<number, ItemInfo>> {
  if (itemByIdCache) return itemByIdCache;
  const res = await fetch("https://api.opendota.com/api/constants/items", {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return {};
  const data = (await res.json()) as Record<string, ItemConst>;
  itemByIdCache = {};
  for (const [key, item] of Object.entries(data)) {
    if (item.id == null) continue;
    itemByIdCache[item.id] = {
      id: item.id,
      key,
      name: item.dname || key,
    };
  }
  return itemByIdCache;
}

export async function loadItemNames(): Promise<Record<number, string>> {
  const catalog = await loadItemCatalog();
  return Object.fromEntries(
    Object.values(catalog).map((i) => [i.id, i.name]),
  );
}

export function parseMatchId(input: string): string {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(
    /(?:opendota\.com\/matches|stratz\.com\/(?:en\/)?matches|dotabuff\.com\/matches)\/(\d+)/i,
  );
  if (fromUrl) return fromUrl[1];
  const digits = trimmed.match(/^!?result\s+(\d{8,12})$/i);
  if (digits) return digits[1];
  if (/^\d{8,12}$/.test(trimmed)) return trimmed;
  throw new Error(
    "Could not find a match ID. Paste the number or an OpenDota / STRATZ / Dotabuff link.",
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestOpenDotaParse(matchId: string) {
  await fetch(`https://api.opendota.com/api/request/${matchId}`, {
    method: "POST",
    cache: "no-store",
  }).catch(() => undefined);
}

export async function fetchOpenDotaMatchIfReady(
  matchId: string,
): Promise<OpenDotaMatch | null> {
  const res = await fetch(`https://api.opendota.com/api/matches/${matchId}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 404) await requestOpenDotaParse(matchId);
    return null;
  }
  const data = (await res.json()) as OpenDotaMatch;
  if (!data.players || data.players.length < 10) {
    await requestOpenDotaParse(matchId);
    return null;
  }
  return data;
}

export async function fetchOpenDotaMatch(
  matchId: string,
): Promise<OpenDotaMatch> {
  const url = `https://api.opendota.com/api/matches/${matchId}`;
  const attempts = 4;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as OpenDotaMatch;
      if (data.players && data.players.length >= 10) return data;
      await requestOpenDotaParse(matchId);
      if (attempt < attempts - 1) {
        await wait(3000);
        continue;
      }
      throw new Error(
        `Match ${matchId} is on OpenDota but not fully parsed yet. Wait a few minutes, then post \`!result ${matchId}\` again.`,
      );
    }
    if (res.status === 404) {
      await requestOpenDotaParse(matchId);
      if (attempt < attempts - 1) {
        await wait(3500);
        continue;
      }
      throw new Error(
        `OpenDota does not have match **${matchId}** yet — the replay is still uploading. I asked OpenDota to fetch it. Wait 3–10 minutes after the lobby ends, then post \`!result ${matchId}\` again.`,
      );
    }
    throw new Error(`OpenDota returned ${res.status}. Try again in a minute.`);
  }
  throw new Error(
    `OpenDota does not have match **${matchId}** yet. Wait a few minutes and try \`!result ${matchId}\` again.`,
  );
}

export function itemIdsOf(player: OpenDotaMatchPlayer): number[] {
  return [
    player.item_0,
    player.item_1,
    player.item_2,
    player.item_3,
    player.item_4,
    player.item_5,
  ].filter((id) => id > 0);
}
