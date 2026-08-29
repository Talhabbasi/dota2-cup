import { prisma } from "./prisma";
import {
  fetchOpenDotaMatch,
  itemIdsOf,
  loadHeroById,
  loadItemCatalog,
  parseMatchId,
} from "./opendota";

export async function ingestMatch(input: {
  raw: string;
  screenshotPath?: string | null;
}) {
  const matchId = parseMatchId(input.raw);
  const existing = await prisma.match.findUnique({
    where: { openDotaId: matchId },
    include: {
      players: { include: { player: true } },
      radiantTeam: true,
      direTeam: true,
      winnerTeam: true,
    },
  });
  if (existing) {
    if (input.screenshotPath && !existing.screenshotPath) {
      return prisma.match.update({
        where: { id: existing.id },
        data: { screenshotPath: input.screenshotPath },
        include: {
          players: { include: { player: true } },
          radiantTeam: true,
          direTeam: true,
          winnerTeam: true,
        },
      });
    }
    throw new Error(`Match ${matchId} is already in the table.`);
  }

  const raw = await fetchOpenDotaMatch(matchId);
  const heroes = await loadHeroById();
  const items = await loadItemCatalog();

  const registered = await prisma.player.findMany();
  const bySteam = new Map(registered.map((p) => [p.steam32, p]));

  type SideCount = Map<string, number>;
  const radiantCounts: SideCount = new Map();
  const direCounts: SideCount = new Map();

  const rows = raw.players!.map((p) => {
    const steam32 = p.account_id ?? 0;
    const mapped = steam32 ? bySteam.get(steam32) : undefined;
    const side = p.player_slot < 128 ? "radiant" : "dire";
    if (mapped?.teamId) {
      const bag = side === "radiant" ? radiantCounts : direCounts;
      bag.set(mapped.teamId, (bag.get(mapped.teamId) ?? 0) + 1);
    }
    const hero = heroes[p.hero_id];
    return {
      steam32,
      playerId: mapped?.id ?? null,
      unknown: !mapped,
      side,
      hero: hero?.name ?? `Hero ${p.hero_id}`,
      heroId: p.hero_id,
      kills: p.kills ?? 0,
      deaths: p.deaths ?? 0,
      assists: p.assists ?? 0,
      lastHits: p.last_hits ?? 0,
      denies: p.denies ?? 0,
      gpm: p.gold_per_min ?? 0,
      xpm: p.xp_per_min ?? 0,
      itemsJson: JSON.stringify(
        itemIdsOf(p).map((id) => {
          const item = items[id];
          return item
            ? { key: item.key, name: item.name }
            : { key: String(id), name: `Item ${id}` };
        }),
      ),
    };
  });

  const pickTeam = (counts: SideCount) => {
    let best: { id: string; n: number } | null = null;
    for (const [id, n] of counts) {
      if (!best || n > best.n) best = { id, n };
    }
    return best && best.n >= 3 ? best.id : null;
  };

  const radiantTeamId = pickTeam(radiantCounts);
  const direTeamId = pickTeam(direCounts);
  const winnerTeamId = raw.radiant_win ? radiantTeamId : direTeamId;

  const match = await prisma.match.create({
    data: {
      openDotaId: matchId,
      duration: raw.duration,
      radiantWin: raw.radiant_win,
      radiantTeamId,
      direTeamId,
      winnerTeamId,
      screenshotPath: input.screenshotPath ?? null,
      startedAt: raw.start_time ? new Date(raw.start_time * 1000) : null,
      players: { create: rows },
    },
    include: {
      players: { include: { player: true } },
      radiantTeam: true,
      direTeam: true,
      winnerTeam: true,
    },
  });

  const { completeScheduledFixture } = await import("./schedule");
  try {
    await completeScheduledFixture({
      radiantTeamId: match.radiantTeamId,
      direTeamId: match.direTeamId,
      winnerTeamId: match.winnerTeamId,
      matchId: match.id,
    });
  } catch {
    /* optional until schedule exists */
  }

  return match;
}

export async function assignUnknown(input: {
  steam32: number;
  discordId: string;
}) {
  const player = await prisma.player.findUnique({
    where: { discordId: input.discordId },
  });
  if (!player) {
    throw new Error("That Discord user is not registered.");
  }

  const clash = await prisma.player.findUnique({
    where: { steam32: input.steam32 },
  });
  if (clash && clash.id !== player.id) {
    throw new Error(
      `Steam ${input.steam32} is already linked to ${clash.discordName}.`,
    );
  }

  await prisma.player.update({
    where: { id: player.id },
    data: { steam32: input.steam32 },
  });

  await prisma.matchPlayer.updateMany({
    where: { steam32: input.steam32 },
    data: { playerId: player.id, unknown: false },
  });

  return player;
}

export async function attachScreenshot(openDotaId: string, screenshotPath: string) {
  const match = await prisma.match.findUnique({ where: { openDotaId } });
  if (!match) {
    throw new Error(`Match ${openDotaId} is not in the database yet. Run !result first.`);
  }
  return prisma.match.update({
    where: { id: match.id },
    data: { screenshotPath },
  });
}
