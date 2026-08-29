import { prisma } from "./prisma";
import {
  loadHeroCatalog,
  loadHeroById,
  heroPortraitUrl,
  heroIconUrl,
  type HeroInfo,
} from "./opendota";

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

export async function getHeroTournamentStats(): Promise<HeroTournamentStat[]> {
  const [catalog, rows] = await Promise.all([
    loadHeroCatalog(),
    prisma.matchPlayer.findMany({
      select: { heroId: true, hero: true },
    }),
  ]);

  const counts = new Map<number, number>();
  const byName = new Map(catalog.map((h) => [h.name.toLowerCase(), h.id]));

  for (const row of rows) {
    let id = row.heroId;
    if (!id) {
      id = byName.get(row.hero.toLowerCase()) ?? 0;
    }
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

export async function getHeroBySlug(slug: string) {
  const catalog = await loadHeroCatalog();
  return catalog.find((h) => h.slug === slug) ?? null;
}

export async function getHeroMatchAppearances(heroId: number, heroName: string) {
  const players = await prisma.matchPlayer.findMany({
    where: {
      OR: [{ heroId }, { hero: heroName, heroId: 0 }],
    },
    include: {
      player: { include: { team: true } },
      match: {
        include: {
          radiantTeam: true,
          direTeam: true,
          winnerTeam: true,
        },
      },
    },
    orderBy: { match: { createdAt: "desc" } },
  });

  return players.map((row) => ({
    ...row,
    items: parseStoredItems(row.itemsJson),
  }));
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
