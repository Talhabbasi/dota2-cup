import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import {
  isDummyDiscordId,
  publicMatchWhere,
  publicPlayerWhere,
  publicTeamWhere,
} from "./dummy";
import { PUBLIC_PAGE_TAG, PUBLIC_REVALIDATE_SECONDS } from "./cache-tags";
import { getNextScheduledFixture } from "./schedule";
import { parseRolesJson } from "./roles";
import { basePriceFor } from "./constants";
import {
  formatDuration,
  formatRoles,
  toIso,
} from "./format";
import {
  currentSeasonFilter,
  getCurrentSeasonSafe,
} from "./seasons";

export { formatDuration, formatRoles };

function cachedPublic<Args extends unknown[], Result>(
  key: string,
  fn: (...args: Args) => Promise<Result>,
) {
  return unstable_cache(fn, [key], {
    tags: [PUBLIC_PAGE_TAG],
    revalidate: PUBLIC_REVALIDATE_SECONDS,
  });
}

const matchListSelect = {
  id: true,
  openDotaId: true,
  duration: true,
  radiantWin: true,
  radiantScore: true,
  direScore: true,
  createdAt: true,
  radiantTeam: { select: { id: true, name: true } },
  direTeam: { select: { id: true, name: true } },
  winnerTeam: { select: { id: true, name: true } },
  players: { select: { side: true, kills: true } },
  scheduledFixture: { select: { bestOf: true } },
} as const;

const teamRefSelect = { select: { id: true, name: true } } as const;

async function loadPlayers() {
  const season = await getCurrentSeasonSafe();
  const players = await prisma.player.findMany({
    where: {
      ...publicPlayerWhere,
      ...(season ? { seasons: { some: { seasonId: season.id } } } : {}),
    },
    select: {
      id: true,
      steamName: true,
      medal: true,
      rolesJson: true,
      teamId: true,
      isCaptain: true,
      rosterRole: true,
      playWindow: true,
      createdAt: true,
      team: { select: { id: true, name: true } },
      seasons: {
        where: season ? { seasonId: season.id } : { seasonId: "__none__" },
        select: {
          teamId: true,
          isCaptain: true,
          rosterRole: true,
          team: { select: { id: true, name: true } },
        },
        take: 1,
      },
    },
    orderBy: [{ teamId: "asc" }, { steamName: "asc" }],
  });
  return players.map((p) => {
    const membership = p.seasons[0];
    const team = membership?.team ?? p.team;
    const teamId = membership ? membership.teamId : p.teamId;
    const isCaptain = membership ? membership.isCaptain : p.isCaptain;
    const rosterRole = membership ? membership.rosterRole : p.rosterRole;
    return {
      id: p.id,
      steamName: p.steamName,
      medal: p.medal,
      playWindow: p.playWindow,
      createdAt: toIso(p.createdAt),
      team,
      teamId,
      isCaptain,
      rosterRole,
      roles: parseRolesJson(p.rolesJson),
      basePrice: basePriceFor(p.medal),
    };
  });
}

export const getPlayers = cachedPublic("players", loadPlayers);

function seatWon(row: {
  side: string;
  match: {
    radiantWin: boolean | null;
    winnerTeamId: string | null;
    radiantTeam: { id: string } | null;
    direTeam: { id: string } | null;
  };
}): boolean | null {
  const teamId =
    row.side === "radiant"
      ? row.match.radiantTeam?.id ?? null
      : row.match.direTeam?.id ?? null;
  if (row.match.winnerTeamId && teamId) {
    return row.match.winnerTeamId === teamId;
  }
  if (row.match.radiantWin == null) return null;
  return row.side === "radiant" ? row.match.radiantWin : !row.match.radiantWin;
}

function aggregateSeatStats(
  seats: {
    kills: number;
    deaths: number;
    assists: number;
    side: string;
    match: {
      radiantWin: boolean | null;
      winnerTeamId: string | null;
      radiantTeam: { id: string } | null;
      direTeam: { id: string } | null;
    };
  }[],
) {
  const games = seats.length;
  let wins = 0;
  let losses = 0;
  let kills = 0;
  let deaths = 0;
  let assists = 0;
  for (const seat of seats) {
    kills += seat.kills;
    deaths += seat.deaths;
    assists += seat.assists;
    const won = seatWon(seat);
    if (won === true) wins += 1;
    else if (won === false) losses += 1;
  }
  const kda =
    games > 0
      ? Number(((kills + assists) / Math.max(1, deaths)).toFixed(2))
      : null;
  return { games, wins, losses, kills, deaths, assists, kda };
}

export async function getPlayer(
  id: string,
  options?: { seasonId?: string | null },
) {
  const player = await prisma.player.findFirst({
    where: { id, ...publicPlayerWhere },
    include: { team: { select: { id: true, name: true } } },
  });
  if (!player || isDummyDiscordId(player.discordId)) return null;

  const [matchPlayers, seasonRows, soldLots, currentSeason] = await Promise.all([
    prisma.matchPlayer.findMany({
      where: {
        OR: [
          { playerId: player.id },
          ...(player.steam32 != null ? [{ steam32: player.steam32 }] : []),
        ],
        match: publicMatchWhere,
      },
      include: {
        match: {
          include: {
            season: { select: { id: true, number: true, name: true } },
            radiantTeam: teamRefSelect,
            direTeam: teamRefSelect,
            winnerTeam: teamRefSelect,
          },
        },
      },
      orderBy: { match: { createdAt: "desc" } },
    }),
    prisma.seasonPlayer.findMany({
      where: { playerId: player.id },
      include: {
        season: {
          select: { id: true, number: true, name: true, status: true, isActive: true },
        },
        team: { select: { id: true, name: true } },
      },
      orderBy: { season: { number: "desc" } },
    }),
    prisma.auctionLot.findMany({
      where: {
        playerId: player.id,
        status: "sold",
        soldPrice: { not: null },
      },
      select: {
        seasonId: true,
        soldPrice: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    getCurrentSeasonSafe(),
  ]);

  const soldPriceBySeason = new Map<string, number>();
  for (const lot of soldLots) {
    if (!lot.seasonId || lot.soldPrice == null) continue;
    if (!soldPriceBySeason.has(lot.seasonId)) {
      soldPriceBySeason.set(lot.seasonId, lot.soldPrice);
    }
  }

  const career = aggregateSeatStats(matchPlayers);
  const seatsBySeason = new Map<string, typeof matchPlayers>();
  for (const seat of matchPlayers) {
    const sid = seat.match.seasonId;
    if (!sid) continue;
    const list = seatsBySeason.get(sid) ?? [];
    list.push(seat);
    seatsBySeason.set(sid, list);
  }

  // Prefer explicit ?season=; else live; else latest membership.
  const focusSeasonId =
    options?.seasonId ??
    currentSeason?.id ??
    seasonRows.find((row) => row.season.isActive)?.seasonId ??
    seasonRows[0]?.seasonId ??
    null;
  const scopedMatchPlayers = focusSeasonId
    ? matchPlayers.filter((row) => row.match.seasonId === focusSeasonId)
    : matchPlayers;

  const seasonTeamBySeason = new Map(
    seasonRows.map((row) => [row.seasonId, row.teamId] as const),
  );

  const focusMembership = focusSeasonId
    ? seasonRows.find((row) => row.seasonId === focusSeasonId)
    : undefined;
  const currentTeam = focusMembership?.team ?? null;
  const currentTeamId = focusMembership?.teamId ?? null;
  const currentCaptain = focusMembership?.isCaptain ?? false;
  const currentRosterRole = focusMembership?.rosterRole ?? null;
  const focusSeasonRow = focusMembership?.season ?? null;
  const focusStats = aggregateSeatStats(scopedMatchPlayers);
  const focusSoldPrice = focusSeasonId
    ? (soldPriceBySeason.get(focusSeasonId) ?? null)
    : null;

  const { discordId: _discordId, discordName: _discordName, ...publicPlayer } =
    player;

  return {
    ...publicPlayer,
    team: currentTeam,
    teamId: currentTeamId,
    isCaptain: currentCaptain,
    rosterRole: currentRosterRole,
    matchPlayers: scopedMatchPlayers.map((row) => ({
      ...row,
      seasonTeamId: row.match.seasonId
        ? (seasonTeamBySeason.get(row.match.seasonId) ?? null)
        : null,
    })),
    focusSeasonId,
    focusStats,
    focusSoldPrice,
    career,
    seasonHistory: seasonRows.map((row) => {
      const stats = aggregateSeatStats(seatsBySeason.get(row.seasonId) ?? []);
      return {
        seasonId: row.season.id,
        number: row.season.number,
        name: row.season.name,
        status: row.season.status,
        teamId: row.team?.id ?? null,
        teamName: row.team?.name ?? null,
        isCaptain: row.isCaptain,
        rosterRole: row.rosterRole,
        soldPrice: soldPriceBySeason.get(row.seasonId) ?? null,
        games: stats.games,
        wins: stats.wins,
        losses: stats.losses,
        kda: stats.kda,
        live: currentSeason?.id === row.season.id,
      };
    }),
    currentSeason: focusSeasonRow
      ? {
          id: focusSeasonRow.id,
          number: focusSeasonRow.number,
          name: focusSeasonRow.name,
        }
      : currentSeason
        ? {
            id: currentSeason.id,
            number: currentSeason.number,
            name: currentSeason.name,
          }
        : null,
    roles: parseRolesJson(player.rolesJson),
    basePrice: basePriceFor(player.medal),
  };
}

async function loadTeams() {
  const season = await currentSeasonFilter();
  return prisma.team.findMany({
    where: { ...publicTeamWhere, ...season },
    select: {
      id: true,
      name: true,
      purse: true,
      groupKey: true,
      players: {
        where: publicPlayerWhere,
        select: {
          id: true,
          steamName: true,
          isCaptain: true,
          rosterRole: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

export const getTeams = cachedPublic("teams", loadTeams);

export const getTeamCount = cachedPublic("team-count", async () => {
  const season = await currentSeasonFilter();
  return prisma.team.count({ where: { ...publicTeamWhere, ...season } });
});

export async function getTeam(id: string) {
  const team = await prisma.team.findFirst({
    where: { id, ...publicTeamWhere },
    select: {
      id: true,
      name: true,
      purse: true,
      groupKey: true,
      seasonId: true,
      players: {
        where: publicPlayerWhere,
        select: {
          id: true,
          steamName: true,
          medal: true,
          rolesJson: true,
          playWindow: true,
          isCaptain: true,
          rosterRole: true,
          createdAt: true,
          teamJoinedAt: true,
        },
        orderBy: [{ isCaptain: "desc" }, { steamName: "asc" }],
      },
      seasonPlayers: {
        where: { player: publicPlayerWhere },
        select: {
          isCaptain: true,
          rosterRole: true,
          medal: true,
          rolesJson: true,
          playWindow: true,
          teamJoinedAt: true,
          player: {
            select: {
              id: true,
              steamName: true,
              medal: true,
              rolesJson: true,
              playWindow: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ isCaptain: "desc" }, { player: { steamName: "asc" } }],
      },
      radiantMatches: {
        where: publicMatchWhere,
        select: {
          id: true,
          seasonId: true,
          openDotaId: true,
          duration: true,
          radiantWin: true,
          createdAt: true,
          radiantTeam: teamRefSelect,
          direTeam: teamRefSelect,
          winnerTeam: teamRefSelect,
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      direMatches: {
        where: publicMatchWhere,
        select: {
          id: true,
          seasonId: true,
          openDotaId: true,
          duration: true,
          radiantWin: true,
          createdAt: true,
          radiantTeam: teamRefSelect,
          direTeam: teamRefSelect,
          winnerTeam: teamRefSelect,
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });
  if (!team) return null;

  const seasonId = team.seasonId;
  const rosterFromSeason =
    seasonId && team.seasonPlayers.length > 0
      ? team.seasonPlayers.map((row) => ({
          id: row.player.id,
          steamName: row.player.steamName,
          medal: row.medal ?? row.player.medal,
          rolesJson: row.rolesJson ?? row.player.rolesJson,
          playWindow: row.playWindow ?? row.player.playWindow,
          isCaptain: row.isCaptain,
          rosterRole: row.rosterRole,
          createdAt: row.player.createdAt,
          teamJoinedAt: row.teamJoinedAt,
        }))
      : team.players;

  const radiantScoped = seasonId
    ? team.radiantMatches.filter((m) => m.seasonId === seasonId)
    : team.radiantMatches;
  const direScoped = seasonId
    ? team.direMatches.filter((m) => m.seasonId === seasonId)
    : team.direMatches;

  return {
    ...team,
    players: rosterFromSeason,
    radiantMatches: radiantScoped.slice(0, 8),
    direMatches: direScoped.slice(0, 8),
  };
}

export const getMatches = cachedPublic("matches", async () => {
  const season = await currentSeasonFilter();
  return prisma.match.findMany({
    where: { ...publicMatchWhere, ...season },
    select: matchListSelect,
    orderBy: { createdAt: "desc" },
  });
});

export const getRecentMatches = cachedPublic(
  "recent-matches",
  async (take: number = 5) => {
    const season = await currentSeasonFilter();
    return prisma.match.findMany({
      where: { ...publicMatchWhere, ...season },
      select: matchListSelect,
      orderBy: { createdAt: "desc" },
      take,
    });
  },
);

export const getMatchCount = cachedPublic("match-count", async () => {
  const season = await currentSeasonFilter();
  return prisma.match.count({ where: { ...publicMatchWhere, ...season } });
});

export async function getMatch(id: string) {
  const match = await prisma.match.findFirst({
    where: { id, ...publicMatchWhere },
    include: {
      radiantTeam: teamRefSelect,
      direTeam: teamRefSelect,
      winnerTeam: teamRefSelect,
      players: {
        include: {
          player: { select: { id: true, steamName: true, teamId: true } },
        },
      },
    },
  });
  if (!match) return null;

  const playerIds = match.players
    .map((row) => row.playerId)
    .filter((value): value is string => Boolean(value));
  const seasonRoster =
    match.seasonId && playerIds.length > 0
      ? await prisma.seasonPlayer.findMany({
          where: {
            seasonId: match.seasonId,
            playerId: { in: playerIds },
          },
          select: { playerId: true, teamId: true },
        })
      : [];
  const teamByPlayer = new Map(
    seasonRoster.map((row) => [row.playerId, row.teamId] as const),
  );

  return {
    ...match,
    players: match.players.map((row) => ({
      ...row,
      seasonTeamId: row.playerId
        ? (teamByPlayer.get(row.playerId) ?? row.player?.teamId ?? null)
        : null,
    })),
  };
}

async function loadStandings() {
  const season = await currentSeasonFilter();
  const [teams, decided] = await Promise.all([
    prisma.team.findMany({
      where: { ...publicTeamWhere, ...season },
      select: { id: true, name: true, purse: true },
      orderBy: { name: "asc" },
    }),
    prisma.match.findMany({
      where: { winnerTeamId: { not: null }, ...publicMatchWhere, ...season },
      select: {
        id: true,
        radiantTeamId: true,
        direTeamId: true,
        winnerTeamId: true,
      },
    }),
  ]);

  const played = new Map<string, Set<string>>();
  const wins = new Map<string, number>();

  for (const match of decided) {
    if (match.radiantTeamId) {
      const set = played.get(match.radiantTeamId) ?? new Set();
      set.add(match.id);
      played.set(match.radiantTeamId, set);
    }
    if (match.direTeamId) {
      const set = played.get(match.direTeamId) ?? new Set();
      set.add(match.id);
      played.set(match.direTeamId, set);
    }
    if (match.winnerTeamId) {
      wins.set(match.winnerTeamId, (wins.get(match.winnerTeamId) ?? 0) + 1);
    }
  }

  return teams
    .map((team) => {
      const games = played.get(team.id)?.size ?? 0;
      const teamWins = wins.get(team.id) ?? 0;
      return {
        id: team.id,
        name: team.name,
        purse: team.purse,
        played: games,
        wins: teamWins,
        losses: games - teamWins,
        points: teamWins * 3,
      };
    })
    .sort(
      (a, b) =>
        b.wins - a.wins || b.points - a.points || a.name.localeCompare(b.name),
    );
}

export const getStandings = cachedPublic("standings", loadStandings);

export type FixturePreview = {
  radiantTeam: { id: string; name: string };
  direTeam: { id: string; name: string };
  scheduledAt?: Date;
  bestOf?: number;
  kind?: string;
  slotKey?: string | null;
};

export async function getUpcomingFixture(): Promise<FixturePreview | null> {
  try {
    const scheduled = await getNextScheduledFixture();
    if (!scheduled) return null;
    return {
      radiantTeam: {
        id: scheduled.radiantTeam.id,
        name: scheduled.radiantTeam.name,
      },
      direTeam: {
        id: scheduled.direTeam.id,
        name: scheduled.direTeam.name,
      },
      scheduledAt: scheduled.scheduledAt,
      bestOf: scheduled.bestOf,
      kind: scheduled.kind,
      slotKey: scheduled.slotKey,
    };
  } catch {
    return null;
  }
}

/** @deprecated Use getUpcomingFixture() — reads from the generated schedule. */
export function guessNextFixture(
  teams: { id: string; name: string }[],
  matches: { radiantTeamId: string | null; direTeamId: string | null }[],
): FixturePreview | null {
  if (teams.length < 2) return null;

  const played = new Set<string>();
  for (const match of matches) {
    if (!match.radiantTeamId || !match.direTeamId) continue;
    const key = [match.radiantTeamId, match.direTeamId].sort().join(":");
    played.add(key);
  }

  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const key = [sorted[i].id, sorted[j].id].sort().join(":");
      if (!played.has(key)) {
        return { radiantTeam: sorted[i], direTeam: sorted[j] };
      }
    }
  }

  return null;
}

export function parseItems(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => {
      if (typeof entry === "string") return entry;
      const obj = entry as { name?: string };
      return obj.name ?? "Item";
    });
  } catch {
    return [];
  }
}

export async function getTeamName(id: string) {
  const team = await prisma.team.findFirst({
    where: { id, ...publicTeamWhere },
    select: { name: true },
  });
  return team?.name ?? null;
}

export async function getPlayerMeta(id: string) {
  const player = await prisma.player.findFirst({
    where: { id, ...publicPlayerWhere },
    select: {
      steamName: true,
      discordId: true,
      team: { select: { name: true } },
    },
  });
  if (!player || isDummyDiscordId(player.discordId)) return null;

  const liveMembership = await prisma.seasonPlayer.findFirst({
    where: {
      playerId: id,
      season: { isActive: true },
    },
    select: { team: { select: { name: true } } },
  });

  return {
    name: player.steamName,
    teamName: liveMembership?.team?.name ?? player.team?.name ?? null,
  };
}

export async function getMatchMeta(id: string) {
  const match = await prisma.match.findFirst({
    where: { id, ...publicMatchWhere },
    select: {
      openDotaId: true,
      radiantTeam: { select: { name: true } },
      direTeam: { select: { name: true } },
    },
  });
  if (!match) return null;
  return {
    title: `${match.radiantTeam?.name ?? "Radiant"} vs ${match.direTeam?.name ?? "Dire"}`,
    openDotaId: match.openDotaId,
  };
}
