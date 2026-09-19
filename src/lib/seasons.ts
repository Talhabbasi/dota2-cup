import { cache } from "react";
import { getCupSettings } from "./cup-settings-cache";
import { prisma } from "./prisma";
import { publicFixtureWhere, publicPlayerWhere } from "./dummy";
import { isRosterSub, sortTeamRoster } from "./roles";

export const SEASON_STATUS = {
  upcoming: "upcoming",
  live: "live",
  archived: "archived",
} as const;

export type SeasonStatus = (typeof SEASON_STATUS)[keyof typeof SEASON_STATUS];

const DEFAULT_SEASON_NUMBER = 1;
const DEFAULT_SEASON_NAME = "Season 1";

type Db = typeof prisma;

function seasonName(number: number, name?: string | null) {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : `Season ${number}`;
}

export async function listSeasons() {
  return prisma.season.findMany({
    orderBy: { number: "asc" },
  });
}

async function loadCurrentSeasonWith(db: Db) {
  const [settings, seasons] = await Promise.all([
    db === prisma
      ? getCupSettings()
      : db.cupSettings.findUnique({ where: { id: "singleton" } }),
    db.season.findMany({ orderBy: { number: "desc" } }),
  ]);
  if (settings?.currentSeasonId) {
    const pointed = seasons.find((season) => season.id === settings.currentSeasonId);
    if (pointed) return pointed;
  }
  return (
    seasons.find((season) => season.status === SEASON_STATUS.live) ??
    seasons[seasons.length - 1] ??
    null
  );
}

const loadCurrentSeason = cache(() => loadCurrentSeasonWith(prisma));

export async function getCurrentSeason(db: Db = prisma) {
  if (db === prisma) return loadCurrentSeason();
  return loadCurrentSeasonWith(db);
}

export async function getCurrentSeasonSafe() {
  try {
    return await getCurrentSeason();
  } catch {
    return null;
  }
}

export async function requireCurrentSeason(db: Db = prisma) {
  const season = await getCurrentSeason(db);
  if (!season) {
    throw new Error("No season is set. Create Season 1 first.");
  }
  return season;
}

export async function ensureDefaultSeason(db: Db = prisma) {
  let season = await getCurrentSeason(db);
  if (!season) {
    season = await db.season.upsert({
      where: { number: DEFAULT_SEASON_NUMBER },
      create: {
        number: DEFAULT_SEASON_NUMBER,
        name: DEFAULT_SEASON_NAME,
        status: SEASON_STATUS.live,
        startedAt: new Date(),
      },
      update: {},
    });
  }

  if (season.number === DEFAULT_SEASON_NUMBER && season.status === SEASON_STATUS.upcoming) {
    season = await db.season.update({
      where: { id: season.id },
      data: { status: SEASON_STATUS.live, startedAt: season.startedAt ?? new Date() },
    });
  }

  const settings = await db.cupSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings) {
    await db.cupSettings.create({
      data: { id: "singleton", currentSeasonId: season.id },
    });
  } else if (settings.currentSeasonId !== season.id) {
    await db.cupSettings.update({
      where: { id: "singleton" },
      data: { currentSeasonId: season.id },
    });
  }

  return season;
}

export async function currentSeasonId(db: Db = prisma) {
  const season = await ensureDefaultSeason(db);
  return season.id;
}

export async function createSeason(input?: { name?: string | null }) {
  const last = await prisma.season.findFirst({
    orderBy: { number: "desc" },
  });
  const number = (last?.number ?? 0) + 1;
  if (number === DEFAULT_SEASON_NUMBER && !last) {
    return ensureDefaultSeason();
  }

  const clash = await prisma.season.findUnique({ where: { number } });
  if (clash) {
    throw new Error(`Season ${number} already exists.`);
  }

  return prisma.season.create({
    data: {
      number,
      name: seasonName(number, input?.name),
      status: SEASON_STATUS.upcoming,
    },
  });
}

export function formatSeasonLabel(season: {
  number: number;
  name: string;
  status: string;
}) {
  return `Season ${season.number} · ${season.name} (${season.status})`;
}

export async function syncSeasonPlayer(playerId: string, db: Db = prisma) {
  const season = await getCurrentSeason(db);
  if (!season) return null;

  const player = await db.player.findUnique({ where: { id: playerId } });
  if (!player) return null;

  return db.seasonPlayer.upsert({
    where: {
      seasonId_playerId: { seasonId: season.id, playerId: player.id },
    },
    create: {
      seasonId: season.id,
      playerId: player.id,
      teamId: player.teamId,
      rosterRole: player.rosterRole,
      teamJoinedAt: player.teamJoinedAt,
      isCaptain: player.isCaptain,
      medal: player.medal,
      rolesJson: player.rolesJson,
      playWindow: player.playWindow,
      paidAt: player.paidAt,
      paymentAmount: player.paymentAmount,
    },
    update: {
      teamId: player.teamId,
      rosterRole: player.rosterRole,
      teamJoinedAt: player.teamJoinedAt,
      isCaptain: player.isCaptain,
      medal: player.medal,
      rolesJson: player.rolesJson,
      playWindow: player.playWindow,
      paidAt: player.paidAt,
      paymentAmount: player.paymentAmount,
    },
  });
}

export async function syncSeasonPlayers(playerIds: string[], db: Db = prisma) {
  const unique = [...new Set(playerIds.filter(Boolean))];
  for (const id of unique) {
    await syncSeasonPlayer(id, db);
  }
}

export async function currentSeasonFilter(): Promise<{ seasonId?: string }> {
  try {
    const season = await getCurrentSeason();
    return season?.id ? { seasonId: season.id } : {};
  } catch {
    return {};
  }
}

export async function startSeason(number: number) {
  const target = await prisma.season.findUnique({ where: { number } });
  if (!target) {
    throw new Error(
      `Season ${number} does not exist. Create it first with \`/season create\`.`,
    );
  }
  const current = await getCurrentSeason();
  if (current?.id === target.id) {
    throw new Error(`**${formatSeasonLabel(target)}** is already live.`);
  }

  if (current) {
    await recordSeasonChampion(current.id);
  }

  await prisma.$transaction(async (tx) => {
    if (current) {
      await tx.season.update({
        where: { id: current.id },
        data: { status: SEASON_STATUS.archived, endedAt: new Date() },
      });
    }
    await tx.season.update({
      where: { id: target.id },
      data: {
        status: SEASON_STATUS.live,
        startedAt: target.startedAt ?? new Date(),
        endedAt: null,
      },
    });
    await tx.cupSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", currentSeasonId: target.id },
      update: { currentSeasonId: target.id },
    });
  });

  return {
    previous: current,
    current: await prisma.season.findUniqueOrThrow({ where: { id: target.id } }),
  };
}

export async function backfillSeason1() {
  const season = await ensureDefaultSeason();

  const [teams, matches, fixtures, lots, payments, players] = await Promise.all([
    prisma.team.updateMany({
      where: { seasonId: null },
      data: { seasonId: season.id },
    }),
    prisma.match.updateMany({
      where: { seasonId: null },
      data: { seasonId: season.id },
    }),
    prisma.scheduledFixture.updateMany({
      where: { seasonId: null },
      data: { seasonId: season.id },
    }),
    prisma.auctionLot.updateMany({
      where: { seasonId: null },
      data: { seasonId: season.id },
    }),
    prisma.payment.updateMany({
      where: { seasonId: null },
      data: { seasonId: season.id },
    }),
    prisma.player.findMany({
      select: { id: true },
    }),
  ]);

  for (const player of players) {
    await syncSeasonPlayer(player.id);
  }

  return {
    season,
    copied: {
      teams: teams.count,
      matches: matches.count,
      fixtures: fixtures.count,
      lots: lots.count,
      payments: payments.count,
      players: players.length,
    },
  };
}

const FINAL_WHERE = {
  OR: [{ kind: "final" }, { slotKey: "final" }],
};

function winnerIdFromFinal(fixture: {
  radiantWins: number;
  direWins: number;
  radiantTeamId: string;
  direTeamId: string;
  match: { winnerTeamId: string | null } | null;
}) {
  if (fixture.radiantWins > fixture.direWins) return fixture.radiantTeamId;
  if (fixture.direWins > fixture.radiantWins) return fixture.direTeamId;
  return fixture.match?.winnerTeamId ?? null;
}

export async function inferSeasonChampionTeamId(seasonId: string) {
  const fixture = await prisma.scheduledFixture.findFirst({
    where: {
      seasonId,
      status: "completed",
      ...FINAL_WHERE,
      ...publicFixtureWhere,
    },
    include: { match: { select: { winnerTeamId: true } } },
    orderBy: { scheduledAt: "desc" },
  });
  if (!fixture) return null;
  return winnerIdFromFinal(fixture);
}

export async function recordSeasonChampion(
  seasonId: string,
  winnerTeamId?: string | null,
) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { id: true, championTeamId: true },
  });
  if (!season) return null;
  if (season.championTeamId) return season.championTeamId;

  const winnerId = winnerTeamId ?? (await inferSeasonChampionTeamId(seasonId));
  if (!winnerId) return null;

  await prisma.season.update({
    where: { id: seasonId },
    data: { championTeamId: winnerId },
  });
  return winnerId;
}

export type SeasonHistoryRosterPlayer = {
  id: string;
  steamName: string;
  isCaptain: boolean;
  isSub: boolean;
};

export type SeasonHistoryRow = {
  id: string;
  number: number;
  name: string;
  status: string;
  startedAt: Date | null;
  endedAt: Date | null;
  live: boolean;
  champion: {
    id: string;
    name: string;
    players: SeasonHistoryRosterPlayer[];
  } | null;
};

export async function getSeasonHistory(): Promise<SeasonHistoryRow[]> {
  const [seasons, current] = await Promise.all([
    prisma.season.findMany({
      orderBy: { number: "desc" },
      include: {
        championTeam: { select: { id: true, name: true } },
      },
    }),
    getCurrentSeasonSafe(),
  ]);

  const rows: SeasonHistoryRow[] = [];
  for (const season of seasons) {
    let championTeam = season.championTeam;
    if (!championTeam) {
      const winnerId = await inferSeasonChampionTeamId(season.id);
      if (winnerId) {
        championTeam = await prisma.team.findUnique({
          where: { id: winnerId },
          select: { id: true, name: true },
        });
      }
    }

    let players: SeasonHistoryRosterPlayer[] = [];
    if (championTeam) {
      const memberships = await prisma.seasonPlayer.findMany({
        where: {
          seasonId: season.id,
          teamId: championTeam.id,
          player: publicPlayerWhere,
        },
        select: {
          isCaptain: true,
          rosterRole: true,
          teamJoinedAt: true,
          createdAt: true,
          player: { select: { id: true, steamName: true } },
        },
      });
      const ordered = sortTeamRoster(
        memberships.map((row) => ({
          ...row,
          createdAt: row.createdAt,
          teamJoinedAt: row.teamJoinedAt,
        })),
      );
      players = ordered.map((row) => ({
        id: row.player.id,
        steamName: row.player.steamName,
        isCaptain: row.isCaptain,
        isSub: isRosterSub(row.rosterRole),
      }));
    }

    rows.push({
      id: season.id,
      number: season.number,
      name: season.name,
      status: season.status,
      startedAt: season.startedAt,
      endedAt: season.endedAt,
      live: current?.id === season.id,
      champion: championTeam
        ? { id: championTeam.id, name: championTeam.name, players }
        : null,
    });
  }

  return rows;
}

export const hasCrownedSeason = cache(async () => {
  try {
    const [stored, completedFinal] = await Promise.all([
      prisma.season.count({
        where: { championTeamId: { not: null } },
      }),
      prisma.scheduledFixture.findFirst({
        where: {
          status: "completed",
          ...FINAL_WHERE,
          ...publicFixtureWhere,
        },
        select: { id: true },
      }),
    ]);
    return stored > 0 || Boolean(completedFinal);
  } catch {
    return false;
  }
});
