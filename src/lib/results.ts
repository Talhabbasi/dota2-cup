import { prisma } from "./prisma";
import { currentSeasonId } from "./seasons";
import {
  fetchOpenDotaMatch,
  fetchOpenDotaMatchIfReady,
  itemIdsOf,
  loadHeroById,
  loadItemCatalog,
  parseMatchId,
  type OpenDotaMatch,
} from "./opendota";

const DUMMY_PREFIX = "test-dummy-";
const DUMMY_TEAM_PREFIX = "test-dummy-team-";

type RecentRow = {
  match_id: number;
  start_time?: number;
};

async function findLatestSharedCupMatch(excludeId?: string) {
  const roster = await prisma.player.findMany({
    where: {
      teamId: { not: null },
      NOT: {
        OR: [
          { discordId: { startsWith: DUMMY_PREFIX } },
          { discordId: { startsWith: DUMMY_TEAM_PREFIX } },
        ],
      },
    },
    select: { steam32: true, teamId: true },
  });
  const cutoff = Math.floor(Date.now() / 1000) - 8 * 3600;
  const byMatch = new Map<
    number,
    { steam: Set<number>; teams: Set<string>; start: number }
  >();

  for (let i = 0; i < roster.length; i += 6) {
    const chunk = roster.slice(i, i + 6);
    await Promise.all(
      chunk.map(async (player) => {
        const res = await fetch(
          `https://api.opendota.com/api/players/${player.steam32}/recentMatches`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const rows = (await res.json()) as RecentRow[];
        if (!Array.isArray(rows)) return;
        for (const row of rows) {
          if (!row.match_id || !row.start_time || row.start_time < cutoff) {
            continue;
          }
          const entry = byMatch.get(row.match_id) ?? {
            steam: new Set<number>(),
            teams: new Set<string>(),
            start: row.start_time,
          };
          entry.steam.add(player.steam32);
          if (player.teamId) entry.teams.add(player.teamId);
          if (row.start_time > entry.start) entry.start = row.start_time;
          byMatch.set(row.match_id, entry);
        }
      }),
    );
  }

  const imported = new Set(
    (
      await prisma.match.findMany({
        select: { openDotaId: true },
      })
    ).map((row) => row.openDotaId),
  );
  if (excludeId) imported.add(excludeId);

  const ranked = [...byMatch.entries()]
    .filter(
      ([id, info]) =>
        !imported.has(String(id)) &&
        info.steam.size >= 6 &&
        info.teams.size >= 2,
    )
    .sort((a, b) => b[1].start - a[1].start || b[1].steam.size - a[1].steam.size);

  return ranked[0] ? String(ranked[0][0]) : null;
}

async function loadMatchPayload(givenId: string): Promise<{
  matchId: string;
  raw: OpenDotaMatch;
  usedLobbyLookup: boolean;
}> {
  const ready = await fetchOpenDotaMatchIfReady(givenId);
  if (ready) return { matchId: givenId, raw: ready, usedLobbyLookup: false };

  const detected = await findLatestSharedCupMatch(givenId);
  if (detected) {
    const raw = await fetchOpenDotaMatch(detected);
    return { matchId: detected, raw, usedLobbyLookup: detected !== givenId };
  }

  try {
    const raw = await fetchOpenDotaMatch(givenId);
    return { matchId: givenId, raw, usedLobbyLookup: false };
  } catch {
    throw new Error(
      `**${givenId}** is a lobby ID, not a Match ID — OpenDota cannot import it. After the game, copy **Match ID** from the post-game scoreboard (or OpenDota / Dotabuff). If the lobby just ended, wait 3–10 minutes then post \`!result\` again and I will try to find the cup game from player histories.`,
    );
  }
}

export async function ingestMatch(input: {
  raw: string;
  screenshotPath?: string | null;
}) {
  const givenId = parseMatchId(input.raw);
  const existingGiven = await prisma.match.findUnique({
    where: { openDotaId: givenId },
    include: {
      players: { include: { player: true } },
      radiantTeam: true,
      direTeam: true,
      winnerTeam: true,
    },
  });
  if (existingGiven) {
    if (input.screenshotPath && !existingGiven.screenshotPath) {
      return prisma.match.update({
        where: { id: existingGiven.id },
        data: { screenshotPath: input.screenshotPath },
        include: {
          players: { include: { player: true } },
          radiantTeam: true,
          direTeam: true,
          winnerTeam: true,
        },
      });
    }
    throw new Error(`Match ${givenId} is already in the table.`);
  }

  const { matchId, raw } = await loadMatchPayload(givenId);
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
      seasonId: await currentSeasonId(),
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
