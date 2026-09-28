import { cache } from "react";
import { getCupSettings } from "./cup-settings-cache";
import { prisma } from "./prisma";
import { publicFixtureWhere, publicPlayerWhere } from "./dummy";
import { SEASON_LABEL } from "./brand";
import { isRosterSub, sortTeamRoster } from "./roles";

export const SEASON_STATUS = {
  upcoming: "upcoming",
  live: "live",
  archived: "archived",
} as const;

export const SEASON_PHASE = {
  UPCOMING: "UPCOMING",
  AUCTION_ACTIVE: "AUCTION_ACTIVE",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
} as const;

export const TOURNAMENT_FORMAT = {
  AUCTION_BASED: "AUCTION_BASED",
  TEAM_BASED: "TEAM_BASED",
} as const;

export const ALLOWED_TEAM_COUNTS = [8, 10, 12] as const;

export type SeasonStatus = (typeof SEASON_STATUS)[keyof typeof SEASON_STATUS];

const DEFAULT_SEASON_NUMBER = 1;
const DEFAULT_SEASON_NAME = SEASON_LABEL;

type Db = typeof prisma;

function seasonName(number: number, name?: string | null) {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : `Season ${number}`;
}

/** Badge text for the season the cup is writing to. Falls back only when none exists yet. */
export function liveSeasonLabel(
  season: { number: number; name: string } | null | undefined,
) {
  if (!season) return SEASON_LABEL;
  return seasonName(season.number, season.name);
}

export async function listSeasons() {
  return prisma.season.findMany({
    orderBy: { number: "asc" },
  });
}

async function loadCurrentSeasonWith(db: Db) {
  const seasons = await db.season.findMany({ orderBy: { number: "desc" } });
  const flagged = seasons.find((season) => season.isActive);
  if (flagged) return flagged;

  const settings =
    db === prisma
      ? await getCupSettings()
      : await db.cupSettings.findUnique({ where: { id: "singleton" } });
  if (settings?.currentSeasonId) {
    const pointed = seasons.find((season) => season.id === settings.currentSeasonId);
    if (pointed && pointed.status !== SEASON_STATUS.archived) return pointed;
  }
  return seasons.find((season) => season.status === SEASON_STATUS.live) ?? null;
}

/** Active live season only — never falls back to archived. */
export async function getLiveSeason(db: Db = prisma) {
  if (db === prisma) return loadCurrentSeason();
  return loadCurrentSeasonWith(db);
}

const loadCurrentSeason = cache(() => loadCurrentSeasonWith(prisma));

export async function getCurrentSeason(db: Db = prisma) {
  return getLiveSeason(db);
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
    throw new Error(`No season is set. Create ${SEASON_LABEL} first.`);
  }
  return season;
}

export async function ensureDefaultSeason(db: Db = prisma) {
  let season = await getLiveSeason(db);
  if (!season) {
    const existing = await db.season.findUnique({
      where: { number: DEFAULT_SEASON_NUMBER },
    });
    if (existing && existing.status !== SEASON_STATUS.archived) {
      season = existing;
    } else if (!existing) {
      season = await db.season.create({
        data: {
          number: DEFAULT_SEASON_NUMBER,
          name: DEFAULT_SEASON_NAME,
          status: SEASON_STATUS.live,
          phase: SEASON_PHASE.IN_PROGRESS,
          isActive: true,
          startedAt: new Date(),
        },
      });
    } else {
      // Season 1 already archived — organizers must create Season 2+ explicitly.
      throw new Error(
        "No live season. Create a new season in Admin → Seasons, then activate it.",
      );
    }
  }

  if (season.number === DEFAULT_SEASON_NUMBER && season.status === SEASON_STATUS.upcoming) {
    season = await setActiveSeason(season.id, db);
  } else if (!season.isActive) {
    season = await setActiveSeason(season.id, db);
  }

  const settings = await db.cupSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings) {
    await db.cupSettings.create({
      data: { id: "singleton", currentSeasonId: season.id },
    });
  } else if (
    settings.currentSeasonId !== season.id &&
    season.status === SEASON_STATUS.live
  ) {
    await db.cupSettings.update({
      where: { id: "singleton" },
      data: { currentSeasonId: season.id },
    });
  }

  return season;
}

export async function currentSeasonId(db: Db = prisma) {
  const live = await getLiveSeason(db);
  if (live?.id) return live.id;

  const upcoming = await db.season.findFirst({
    where: { status: SEASON_STATUS.upcoming },
    orderBy: { number: "desc" },
  });
  if (upcoming) return upcoming.id;

  const season = await ensureDefaultSeason(db);
  return season.id;
}

export async function seasonScope(
  viewSeasonId?: string | null,
): Promise<{ seasonId?: string }> {
  if (viewSeasonId?.trim()) return { seasonId: viewSeasonId.trim() };
  return currentSeasonFilter();
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
      phase: SEASON_PHASE.UPCOMING,
    },
  });
}

export type CreateSeasonAdminInput = {
  name: string;
  plannedStartAt?: Date | null;
  tournamentFormat?: string;
  teamCount?: number;
};

export async function createSeasonAdmin(input: CreateSeasonAdminInput) {
  const name = input.name?.trim();
  if (!name) throw new Error("Season name is required.");

  const format =
    input.tournamentFormat === TOURNAMENT_FORMAT.TEAM_BASED
      ? TOURNAMENT_FORMAT.TEAM_BASED
      : TOURNAMENT_FORMAT.AUCTION_BASED;

  const teamCount = input.teamCount ?? 8;
  if (!(ALLOWED_TEAM_COUNTS as readonly number[]).includes(teamCount)) {
    throw new Error("Team count must be 8, 10, or 12.");
  }

  const last = await prisma.season.findFirst({ orderBy: { number: "desc" } });
  const number = (last?.number ?? 0) + 1;

  return prisma.season.create({
    data: {
      number,
      name: seasonName(number, name),
      status: SEASON_STATUS.upcoming,
      phase: SEASON_PHASE.UPCOMING,
      plannedStartAt: input.plannedStartAt ?? null,
      tournamentFormat: format,
      teamCount,
    },
  });
}

export type UpdateSeasonAdminInput = {
  seasonId: string;
  name: string;
  plannedStartAt?: Date | null;
  tournamentFormat?: string;
  teamCount?: number;
};

export async function updateSeasonAdmin(input: UpdateSeasonAdminInput) {
  const season = await prisma.season.findUnique({ where: { id: input.seasonId } });
  if (!season) throw new Error("Season not found.");

  const name = input.name?.trim();
  if (!name) throw new Error("Season name is required.");

  const format =
    input.tournamentFormat === TOURNAMENT_FORMAT.TEAM_BASED
      ? TOURNAMENT_FORMAT.TEAM_BASED
      : input.tournamentFormat === TOURNAMENT_FORMAT.AUCTION_BASED
        ? TOURNAMENT_FORMAT.AUCTION_BASED
        : season.tournamentFormat;

  const teamCount = input.teamCount ?? season.teamCount;
  if (!(ALLOWED_TEAM_COUNTS as readonly number[]).includes(teamCount)) {
    throw new Error("Team count must be 8, 10, or 12.");
  }

  return prisma.season.update({
    where: { id: season.id },
    data: {
      name: seasonName(season.number, name),
      plannedStartAt:
        input.plannedStartAt === undefined
          ? season.plannedStartAt
          : input.plannedStartAt,
      tournamentFormat: format,
      teamCount,
    },
  });
}

/**
 * Delete a season. Empty seasons delete cleanly.
 * Seasons with teams require force=true (wipes season-scoped teams after detaching players).
 */
export async function deleteSeasonAdmin(
  seasonId: string,
  options?: { force?: boolean },
) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      _count: {
        select: { teams: true, matches: true, fixtures: true, players: true },
      },
    },
  });
  if (!season) throw new Error("Season not found.");

  const hasData =
    season._count.teams > 0 ||
    season._count.matches > 0 ||
    season._count.fixtures > 0 ||
    season._count.players > 0;

  if (hasData && !options?.force) {
    throw new Error(
      `${formatSeasonLabel(season)} still has teams/matches/players. Confirm force delete to wipe season-scoped data.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.cupSettings.updateMany({
      where: { currentSeasonId: seasonId },
      data: { currentSeasonId: null },
    });

    await tx.season.update({
      where: { id: seasonId },
      data: { championTeamId: null, isActive: false },
    });

    const teams = await tx.team.findMany({
      where: { seasonId },
      select: { id: true },
    });
    const teamIds = teams.map((t) => t.id);

    if (teamIds.length > 0) {
      await tx.player.updateMany({
        where: { teamId: { in: teamIds } },
        data: { teamId: null, isCaptain: false, rosterRole: null },
      });
      await tx.seasonPlayer.updateMany({
        where: { seasonId },
        data: { teamId: null },
      });
      await tx.matchPrediction.deleteMany({
        where: {
          OR: [{ seasonId }, { predictedTeamId: { in: teamIds } }],
        },
      });
      await tx.bracketPick.deleteMany({
        where: {
          OR: [{ seasonId }, { predictedTeamId: { in: teamIds } }],
        },
      });
      await tx.match.updateMany({
        where: {
          OR: [
            { seasonId },
            { radiantTeamId: { in: teamIds } },
            { direTeamId: { in: teamIds } },
            { winnerTeamId: { in: teamIds } },
          ],
        },
        data: {
          seasonId: null,
          radiantTeamId: null,
          direTeamId: null,
          winnerTeamId: null,
        },
      });
      await tx.captainAccount.deleteMany({ where: { seasonId } });
      await tx.auctionLot.deleteMany({ where: { seasonId } });
      // Fixtures cascade from team delete.
      await tx.team.deleteMany({ where: { seasonId } });
    } else {
      await tx.matchPrediction.deleteMany({ where: { seasonId } });
      await tx.bracketPick.deleteMany({ where: { seasonId } });
      await tx.match.updateMany({
        where: { seasonId },
        data: { seasonId: null },
      });
      await tx.scheduledFixture.updateMany({
        where: { seasonId },
        data: { seasonId: null },
      });
    }

    await tx.seasonPlayer.deleteMany({ where: { seasonId } });
    await tx.seasonSnapshot.deleteMany({ where: { seasonId } });
    await tx.payment.updateMany({
      where: { seasonId },
      data: { seasonId: null },
    });
    await tx.auctionLot.updateMany({
      where: { seasonId },
      data: { seasonId: null },
    });

    await tx.season.delete({ where: { id: seasonId } });
  });

  return season;
}

export type PublicSeasonRow = {
  id: string;
  number: number;
  name: string;
  status: string;
  phase: string;
  plannedStartAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  isActive: boolean;
  championName: string | null;
};

export async function listPublicSeasons(): Promise<PublicSeasonRow[]> {
  const [rows, live] = await Promise.all([
    prisma.season.findMany({
      orderBy: { number: "desc" },
      include: { championTeam: { select: { name: true } } },
    }),
    getLiveSeason(),
  ]);
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    name: row.name,
    status: row.status,
    phase: row.phase,
    plannedStartAt: row.plannedStartAt,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    isActive: live?.id === row.id,
    championName: row.championTeam?.name ?? null,
  }));
}

export async function getSeasonByIdOrNumber(
  idOrNumber: string,
): Promise<PublicSeasonRow | null> {
  const trimmed = idOrNumber.trim();
  const asNum = Number(trimmed);
  const row = await prisma.season.findFirst({
    where: Number.isFinite(asNum)
      ? { OR: [{ id: trimmed }, { number: asNum }] }
      : { id: trimmed },
    include: { championTeam: { select: { name: true } } },
  });
  if (!row) return null;
  const live = await getLiveSeason();
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    status: row.status,
    phase: row.phase,
    plannedStartAt: row.plannedStartAt,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    isActive: Boolean(row.isActive) || live?.id === row.id,
    championName: row.championTeam?.name ?? null,
  };
}

export async function listSeasonsForAdmin() {
  return prisma.season.findMany({
    orderBy: { number: "desc" },
    include: {
      championTeam: { select: { id: true, name: true } },
      _count: {
        select: { teams: true, matches: true, fixtures: true, players: true },
      },
    },
  });
}

/**
 * Mark exactly one season as the site-wide active cup.
 * Clears isActive on all others and points CupSettings.currentSeasonId at the target.
 * You can flip freely between Season 1, Season 2, etc. (including re-activating an archived season).
 */
export async function setActiveSeason(seasonId: string, db: Db = prisma) {
  const target = await db.season.findUnique({ where: { id: seasonId } });
  if (!target) throw new Error("Season not found.");

  const promoteFromArchive = target.status === SEASON_STATUS.archived;
  const promoteFromUpcoming = target.status === SEASON_STATUS.upcoming;

  await db.$transaction(async (tx) => {
    await tx.season.updateMany({ data: { isActive: false } });
    await tx.season.update({
      where: { id: target.id },
      data: {
        isActive: true,
        status:
          promoteFromArchive || promoteFromUpcoming
            ? SEASON_STATUS.live
            : target.status === SEASON_STATUS.live
              ? SEASON_STATUS.live
              : target.status,
        phase:
          promoteFromArchive ||
          promoteFromUpcoming ||
          target.phase === SEASON_PHASE.COMPLETED
            ? SEASON_PHASE.IN_PROGRESS
            : target.phase,
        startedAt: target.startedAt ?? new Date(),
        endedAt: promoteFromArchive ? null : target.endedAt,
      },
    });
    await tx.cupSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", currentSeasonId: target.id },
      update: { currentSeasonId: target.id },
    });
  });

  // Mirror this season's payment ledger onto Player.paidAt for legacy readers.
  if (db === prisma) {
    const { hydratePlayerPaymentsFromSeason } = await import("./payments");
    await hydratePlayerPaymentsFromSeason(target.id);
  }

  return db.season.findUniqueOrThrow({ where: { id: target.id } });
}

/** @deprecated Prefer setActiveSeason — kept for admin action name compatibility. */
export async function activateSeason(seasonId: string) {
  return setActiveSeason(seasonId);
}

export async function endSeasonArchive(seasonId: string) {
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) throw new Error("Season not found.");
  if (season.status === SEASON_STATUS.archived) {
    throw new Error("That season is already archived.");
  }

  await recordSeasonChampion(seasonId);

  const updated = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { championTeamId: true },
  });
  const championId =
    updated?.championTeamId ?? (await inferSeasonChampionTeamId(seasonId));

  let bracketJson: string | null = null;
  let finalScore: string | null = null;
  try {
    const { getPlayoffView } = await import("./playoff");
    const view = await getPlayoffView();
    bracketJson = JSON.stringify(view);
  } catch {
    bracketJson = null;
  }

  const final = await prisma.scheduledFixture.findFirst({
    where: {
      seasonId,
      status: "completed",
      ...FINAL_WHERE,
      ...publicFixtureWhere,
    },
    select: { radiantWins: true, direWins: true },
    orderBy: { scheduledAt: "desc" },
  });
  if (final) {
    finalScore = `${Math.max(final.radiantWins, final.direWins)}–${Math.min(final.radiantWins, final.direWins)}`;
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.seasonSnapshot.upsert({
      where: { seasonId },
      create: {
        seasonId,
        archivedAt: now,
        championTeamId: championId,
        finalScore,
        bracketJson,
        predictionsLockedAt: now,
        insightsJson: "{}",
      },
      update: {
        archivedAt: now,
        championTeamId: championId,
        finalScore,
        bracketJson,
        predictionsLockedAt: now,
      },
    });
    await tx.season.update({
      where: { id: seasonId },
      data: {
        status: SEASON_STATUS.archived,
        phase: SEASON_PHASE.COMPLETED,
        isActive: false,
        endedAt: now,
        championTeamId: championId ?? undefined,
      },
    });
    await tx.cupSettings.update({
      where: { id: "singleton" },
      data: { currentSeasonId: null },
    });
  });

  return prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
}

export async function getSeasonSnapshotBracket(
  seasonId: string,
): Promise<import("./playoff").PlayoffView | null> {
  const snap = await prisma.seasonSnapshot.findUnique({
    where: { seasonId },
    select: { bracketJson: true },
  });
  if (!snap?.bracketJson) return null;
  try {
    return JSON.parse(snap.bracketJson) as import("./playoff").PlayoffView;
  } catch {
    return null;
  }
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
      // Keep season-scoped payment fields; do not overwrite from global Player.
    },
  });
}

export async function syncSeasonPlayers(playerIds: string[], db: Db = prisma) {
  const unique = [...new Set(playerIds.filter(Boolean))];
  for (const id of unique) {
    await syncSeasonPlayer(id, db);
  }
}

export async function currentSeasonFilter(): Promise<{ seasonId: string }> {
  try {
    const season = await getLiveSeason();
    // Never omit seasonId — an empty filter returns every season's data.
    return { seasonId: season?.id ?? "__none__" };
  } catch {
    return { seasonId: "__none__" };
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

  if (current && current.id !== target.id) {
    await endSeasonArchive(current.id);
  } else if (current) {
    await recordSeasonChampion(current.id);
  }

  const activated = await activateSeason(target.id);
  return {
    previous: current?.id !== target.id ? current : null,
    current: activated,
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
    select: { id: true, championTeamId: true, endedAt: true },
  });
  if (!season) return null;

  const winnerId =
    season.championTeamId ??
    winnerTeamId ??
    (await inferSeasonChampionTeamId(seasonId));
  if (!winnerId) return null;

  if (!season.championTeamId) {
    await prisma.season.update({
      where: { id: seasonId },
      data: {
        championTeamId: winnerId,
      },
    });
  }
  return winnerId;
}

export type SeasonHistoryRosterPlayer = {
  id: string;
  steamName: string;
  isCaptain: boolean;
  isSub: boolean;
};

export type SeasonChampion = {
  seasonId: string;
  seasonNumber: number;
  seasonName: string;
  team: { id: string; name: string };
  players: SeasonHistoryRosterPlayer[];
  finalScore: string | null;
};

/** Current season champion + roster when the Grand Final (or stored crown) is set. */
export const getCurrentSeasonChampion = cache(
  async (): Promise<SeasonChampion | null> => {
    try {
      const season = await getLiveSeason();
      if (!season || season.status !== SEASON_STATUS.live) return null;

      let teamId = season.championTeamId;
      if (!teamId) {
        teamId = await inferSeasonChampionTeamId(season.id);
        if (teamId) await recordSeasonChampion(season.id, teamId);
      }
      if (!teamId) return null;

      const [team, memberships, final] = await Promise.all([
        prisma.team.findUnique({
          where: { id: teamId },
          select: { id: true, name: true },
        }),
        prisma.seasonPlayer.findMany({
          where: {
            seasonId: season.id,
            teamId,
            player: publicPlayerWhere,
          },
          select: {
            isCaptain: true,
            rosterRole: true,
            teamJoinedAt: true,
            createdAt: true,
            player: { select: { id: true, steamName: true } },
          },
        }),
        prisma.scheduledFixture.findFirst({
          where: {
            seasonId: season.id,
            status: "completed",
            ...FINAL_WHERE,
            ...publicFixtureWhere,
          },
          select: { radiantWins: true, direWins: true },
          orderBy: { scheduledAt: "desc" },
        }),
      ]);
      if (!team) return null;

      const ordered = sortTeamRoster(
        memberships.map((row) => ({
          ...row,
          createdAt: row.createdAt,
          teamJoinedAt: row.teamJoinedAt,
        })),
      );

      return {
        seasonId: season.id,
        seasonNumber: season.number,
        seasonName: seasonName(season.number, season.name),
        team,
        players: ordered.map((row) => ({
          id: row.player.id,
          steamName: row.player.steamName,
          isCaptain: row.isCaptain,
          isSub: isRosterSub(row.rosterRole),
        })),
        finalScore: final
          ? `${Math.max(final.radiantWins, final.direWins)}–${Math.min(final.radiantWins, final.direWins)}`
          : null,
      };
    } catch {
      return null;
    }
  },
);

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
    getLiveSeason(),
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
