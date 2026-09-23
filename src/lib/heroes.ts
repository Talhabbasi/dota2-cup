import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import {
  loadHeroCatalog,
  loadHeroById,
  heroPortraitUrl,
  heroIconUrl,
  type HeroInfo,
} from "./opendota";
import { publicMatchWhere, publicPlayerWhere } from "./dummy";
import { PUBLIC_PAGE_TAG, PUBLIC_REVALIDATE_SECONDS } from "./cache-tags";
import { currentSeasonFilter } from "./seasons";

export type HeroTournamentStat = HeroInfo & {
  plays: number;
  portrait: string;
  icon: string;
};

export type StoredItem = {
  key: string;
  name: string;
};

export function parseStoredItems(json: string): StoredItem[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => {
      if (typeof entry === "string") {
        return { key: "", name: entry };
      }
      const obj = entry as { key?: string; name?: string };
      return {
        key: obj.key ?? "",
        name: obj.name ?? "Item",
      };
    });
  } catch {
    return [];
  }
}

async function loadHeroTournamentStats(): Promise<HeroTournamentStat[]> {
  const season = await currentSeasonFilter();
  const matchWhere = { ...publicMatchWhere, ...season };
  const [catalog, grouped, unnamed] = await Promise.all([
    loadHeroCatalog(),
    prisma.matchPlayer.groupBy({
      by: ["heroId"],
      where: {
        heroId: { gt: 0 },
        match: matchWhere,
        OR: [{ playerId: null }, { player: publicPlayerWhere }],
      },
      _count: { _all: true },
    }),
    prisma.matchPlayer.findMany({
      where: {
        heroId: 0,
        match: matchWhere,
        OR: [{ playerId: null }, { player: publicPlayerWhere }],
      },
      select: { hero: true },
    }),
  ]);

  const counts = new Map<number, number>();
  const byName = new Map(catalog.map((h) => [h.name.toLowerCase(), h.id]));

  for (const row of grouped) {
    counts.set(row.heroId, (counts.get(row.heroId) ?? 0) + row._count._all);
  }
  for (const row of unnamed) {
    const id = byName.get(row.hero.toLowerCase()) ?? 0;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return catalog.map((hero) => ({
    ...hero,
    plays: counts.get(hero.id) ?? 0,
    portrait: heroPortraitUrl(hero.slug),
    icon: heroIconUrl(hero.slug),
  }));
}

export const getHeroTournamentStats = unstable_cache(
  loadHeroTournamentStats,
  ["hero-stats"],
  { tags: [PUBLIC_PAGE_TAG], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

export async function getHeroBySlug(slug: string) {
  const catalog = await loadHeroCatalog();
  return catalog.find((h) => h.slug === slug) ?? null;
}

export async function getHeroMatchAppearances(heroId: number, heroName: string) {
  const season = await currentSeasonFilter();
  const players = await prisma.matchPlayer.findMany({
    where: {
      AND: [
        { OR: [{ heroId }, { hero: heroName, heroId: 0 }] },
        { match: { ...publicMatchWhere, ...season } },
        { OR: [{ playerId: null }, { player: publicPlayerWhere }] },
      ],
    },
    include: {
      player: { include: { team: { select: { id: true, name: true } } } },
      match: {
        include: {
          radiantTeam: { select: { id: true, name: true } },
          direTeam: { select: { id: true, name: true } },
          winnerTeam: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { match: { createdAt: "desc" } },
  });

  return players;
}

export async function backfillHeroIds() {
  const byId = await loadHeroById();
  const byName = new Map(
    Object.values(byId).map((h) => [h.name.toLowerCase(), h.id]),
  );
  const rows = await prisma.matchPlayer.findMany({
    where: { heroId: 0 },
  });
  for (const row of rows) {
    const id = byName.get(row.hero.toLowerCase());
    if (!id) continue;
    await prisma.matchPlayer.update({
      where: { id: row.id },
      data: { heroId: id },
    });
  }
}
