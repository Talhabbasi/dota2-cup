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
import {
  fetchSteamMatchDetails,
  fetchSteamRecentMatchIds,
} from "./steam-match";

const DUMMY_PREFIX = "test-dummy-";
const DUMMY_TEAM_PREFIX = "test-dummy-team-";

type RecentRow = {
  match_id: number;
  start_time?: number;
};

const MATCH_INCLUDE = {
  players: { include: { player: true } },
  radiantTeam: true,
  direTeam: true,
  winnerTeam: true,
} as const;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function missingStatsError(givenId?: string) {
  const who = givenId ? `**${givenId}** is not a Dota Match ID OpenDota/Steam can load. ` : "";
  return (
    `${who}Heroes and items only import with the **Match ID** from the post-game scoreboard ` +
    `(bottom of the screen after the game — not Lobby ID). Then post \`!result 8123456789\` in #results. ` +
    `You can also try \`/result import\` after a few minutes.`
  );
}

async function fetchPlayerMatchRows(steam32: number): Promise<RecentRow[]> {
  const steamRows = await fetchSteamRecentMatchIds(steam32);
  if (steamRows.length > 0) return steamRows;

  const url = `https://api.opendota.com/api/players/${steam32}/matches?limit=20&significant=0`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status === 429) {
      await wait(1600);
      continue;
    }
    if (!res.ok) return [];
    const rows = (await res.json()) as RecentRow[];
    return Array.isArray(rows) ? rows : [];
  }
  return [];
}

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
  const cutoff = Math.floor(Date.now() / 1000) - 12 * 3600;
  const byMatch = new Map<
    number,
    { steam: Set<number>; teams: Set<string>; start: number }
  >();

  for (let i = 0; i < roster.length; i += 3) {
    const chunk = roster.slice(i, i + 3);
    await Promise.all(
      chunk.map(async (player) => {
        const rows = await fetchPlayerMatchRows(player.steam32);
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
    if (i + 3 < roster.length) await wait(350);
  }

  const imported = new Set(
    (
      await prisma.match.findMany({
        select: { openDotaId: true },
      })
    )
      .map((row) => row.openDotaId)
      .filter((id) => !id.startsWith("manual-")),
  );
  if (excludeId) imported.add(excludeId);

  const ranked = [...byMatch.entries()]
    .filter(
      ([id, info]) =>
        !imported.has(String(id)) &&
        info.steam.size >= 4 &&
        info.teams.size >= 2,
    )
    .sort((a, b) => b[1].start - a[1].start || b[1].steam.size - a[1].steam.size);

  return ranked[0] ? String(ranked[0][0]) : null;
}

async function loadRawMatch(matchId: string): Promise<OpenDotaMatch | null> {
  const ready = await fetchOpenDotaMatchIfReady(matchId);
  if (ready) return ready;
  const steam = await fetchSteamMatchDetails(matchId);
  if (steam) return steam;
  try {
    return await fetchOpenDotaMatch(matchId);
  } catch {
    return fetchSteamMatchDetails(matchId);
  }
}

async function loadMatchPayload(givenId: string): Promise<{
  matchId: string;
  raw: OpenDotaMatch;
}> {
  const direct = await loadRawMatch(givenId);
  if (direct) return { matchId: givenId, raw: direct };

  const detected = await findLatestSharedCupMatch(givenId);
  if (detected) {
    const raw = await loadRawMatch(detected);
    if (raw) return { matchId: detected, raw };
  }

  throw new Error(missingStatsError(givenId));
}

async function findFillableStub(radiantTeamId: string | null, direTeamId: string | null) {
  const recent = await prisma.match.findMany({
    where: { openDotaId: { startsWith: "manual-" } },
    include: {
      players: { select: { id: true } },
      scheduledFixture: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const empty = recent.filter((row) => row.players.length === 0);
  if (radiantTeamId && direTeamId) {
    const hit = empty.find((row) => {
      const ids = new Set([row.radiantTeamId, row.direTeamId]);
      return ids.has(radiantTeamId) && ids.has(direTeamId);
    });
    if (hit) return hit;
  }
  return empty[0] ?? null;
}

export async function ingestLatestCupMatch(input?: {
  screenshotPath?: string | null;
}) {
  return ingestMatch({ raw: "latest", screenshotPath: input?.screenshotPath });
}

export async function ingestMatch(input: {
  raw: string;
  screenshotPath?: string | null;
}) {
  const trimmed = input.raw.trim();
  let givenId: string;
  if (!trimmed || /^latest$/i.test(trimmed)) {
    const detected = await findLatestSharedCupMatch();
    if (!detected) throw new Error(missingStatsError());
    givenId = detected;
  } else {
    givenId = parseMatchId(input.raw);
  }
  const existingGiven = await prisma.match.findUnique({
    where: { openDotaId: givenId },
    include: MATCH_INCLUDE,
  });
  if (existingGiven) {
    if (input.screenshotPath && !existingGiven.screenshotPath) {
      return prisma.match.update({
        where: { id: existingGiven.id },
        data: { screenshotPath: input.screenshotPath },
        include: MATCH_INCLUDE,
      });
    }
    throw new Error(`Match ${givenId} is already in the table.`);
  }

  const { matchId, raw } = await loadMatchPayload(givenId);
  const existing = await prisma.match.findUnique({
    where: { openDotaId: matchId },
    include: MATCH_INCLUDE,
  });
  if (existing) {
    if (input.screenshotPath && !existing.screenshotPath) {
      return prisma.match.update({
        where: { id: existing.id },
        data: { screenshotPath: input.screenshotPath },
        include: MATCH_INCLUDE,
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
      boardName: (p as { personaname?: string }).personaname?.trim() ?? "",
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
  const stub = await findFillableStub(radiantTeamId, direTeamId);
  const payload = {
    openDotaId: matchId,
    duration: raw.duration,
    radiantWin: raw.radiant_win,
    radiantTeamId: radiantTeamId ?? stub?.radiantTeamId ?? null,
    direTeamId: direTeamId ?? stub?.direTeamId ?? null,
    winnerTeamId: winnerTeamId ?? stub?.winnerTeamId ?? null,
    screenshotPath: input.screenshotPath ?? stub?.screenshotPath ?? null,
    startedAt: raw.start_time
      ? new Date(raw.start_time * 1000)
      : (stub?.startedAt ?? null),
    radiantScore: rows
      .filter((row) => row.side === "radiant")
      .reduce((sum, row) => sum + row.kills, 0),
    direScore: rows
      .filter((row) => row.side === "dire")
      .reduce((sum, row) => sum + row.kills, 0),
  };

  const match = stub
    ? await prisma.match.update({
        where: { id: stub.id },
        data: { ...payload, players: { create: rows } },
        include: MATCH_INCLUDE,
      })
    : await prisma.match.create({
        data: {
          seasonId: await currentSeasonId(),
          ...payload,
          players: { create: rows },
        },
        include: MATCH_INCLUDE,
      });

  if (stub?.scheduledFixture?.status !== "completed") {
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
  }

  return match;
}

/** Record a series winner without OpenDota (lobby ID only / replay not public yet). */
export async function recordManualSeriesWinner(input: {
  fixtureId: string;
  winnerName: string;
}) {
  const fixture = await prisma.scheduledFixture.findUnique({
    where: { id: input.fixtureId },
    include: {
      radiantTeam: true,
      direTeam: true,
      match: true,
    },
  });
  if (!fixture) {
    throw new Error("That scheduled match was not found. Pick it from the dropdown.");
  }
  if (fixture.status === "completed") {
    throw new Error(
      `**${fixture.radiantTeam.name}** vs **${fixture.direTeam.name}** is already completed.`,
    );
  }

  const want = input.winnerName.trim().toLowerCase();
  const winner =
    fixture.radiantTeam.name.toLowerCase() === want
      ? fixture.radiantTeam
      : fixture.direTeam.name.toLowerCase() === want
        ? fixture.direTeam
        : null;
  if (!winner) {
    throw new Error(
      `Winner must be **${fixture.radiantTeam.name}** or **${fixture.direTeam.name}**.`,
    );
  }

  let match = fixture.match;
  if (!match) {
    match = await prisma.match.create({
      data: {
        seasonId: fixture.seasonId ?? (await currentSeasonId()),
        openDotaId: `manual-${fixture.id}`,
        radiantWin: winner.id === fixture.radiantTeamId,
        radiantTeamId: fixture.radiantTeamId,
        direTeamId: fixture.direTeamId,
        winnerTeamId: winner.id,
        startedAt: fixture.scheduledAt,
      },
    });
  } else if (!match.winnerTeamId) {
    match = await prisma.match.update({
      where: { id: match.id },
      data: {
        radiantWin: winner.id === fixture.radiantTeamId,
        winnerTeamId: winner.id,
      },
    });
  }

  const { completeScheduledFixture } = await import("./schedule");
  await completeScheduledFixture({
    radiantTeamId: fixture.radiantTeamId,
    direTeamId: fixture.direTeamId,
    winnerTeamId: winner.id,
    matchId: match.id,
  });

  return {
    radiant: fixture.radiantTeam.name,
    dire: fixture.direTeam.name,
    winner: winner.name,
  };
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

export async function attachScreenshotToLatestMatch(screenshotPath: string) {
  const match = await prisma.match.findFirst({
    where: {
      OR: [
        { openDotaId: { startsWith: "manual-" } },
        { players: { none: {} } },
      ],
    },
    include: MATCH_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  if (!match) {
    throw new Error(
      "No recorded match to attach that screenshot to. Record the winner with `/result winner` first.",
    );
  }
  return prisma.match.update({
    where: { id: match.id },
    data: { screenshotPath },
    include: MATCH_INCLUDE,
  });
}
