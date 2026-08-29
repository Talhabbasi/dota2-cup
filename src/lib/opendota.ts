export type OpenDotaMatchPlayer = {
  account_id?: number;
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

export function heroPortraitUrl(slug: string): string {
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${slug}.png`;
}

export function heroIconUrl(slug: string): string {
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/icons/${slug}.png`;
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

export async function fetchOpenDotaMatch(
  matchId: string,
): Promise<OpenDotaMatch> {
  const res = await fetch(`https://api.opendota.com/api/matches/${matchId}`);
  if (res.status === 404) {
    throw new Error(
      "OpenDota does not have this match yet. Wait a few minutes after the game and try again.",
    );
  }
  if (!res.ok) {
    throw new Error(`OpenDota returned ${res.status}. Try again in a minute.`);
  }
  const data = (await res.json()) as OpenDotaMatch;
  if (!data.players || data.players.length < 10) {
    throw new Error(
      "This match is not fully parsed yet. Wait a few minutes and run !result again.",
    );
  }
  return data;
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
