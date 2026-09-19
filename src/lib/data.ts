import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import {
  isDummyDiscordId,
  publicMatchWhere,
  publicPlayerWhere,
  publicTeamWhere,
} from "./dummy";
import { PUBLIC_PAGE_TAG } from "./cache-tags";
import { getNextScheduledFixture } from "./schedule";
import { parseRolesJson } from "./roles";
import { basePriceFor } from "./constants";
import {
  formatDuration,
  formatMatchWhen,
  formatRoles,
} from "./format";
import {
  currentSeasonFilter,
  getCurrentSeasonSafe,
} from "./seasons";

export { formatDuration, formatMatchWhen, formatRoles };

function cachedPublic<Args extends unknown[], Result>(
  key: string,
  fn: (...args: Args) => Promise<Result>,
) {
  return unstable_cache(fn, [key], {
    tags: [PUBLIC_PAGE_TAG],
    revalidate: 15,
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
      ...p,
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

export async function getPlayer(id: string) {
  const player = await prisma.player.findFirst({
    where: { id, ...publicPlayerWhere },
    include: { team: { select: { id: true, name: true } } },
  });
  if (!player || isDummyDiscordId(player.discordId)) return null;

  const [matchPlayers, seasonRows, currentSeason] = await Promise.all([
    prisma.matchPlayer.findMany({
      where: {
        OR: [{ playerId: player.id }, { steam32: player.steam32 }],
        match: publicMatchWhere,
      },
      include: {
        match: {
          include: {
            season: { select: { number: true, name: true } },
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
          select: { id: true, number: true, name: true, status: true },
        },
        team: { select: { id: true, name: true } },
      },
      orderBy: { season: { number: "desc" } },
    }),
    getCurrentSeasonSafe(),
  ]);

  const liveMembership = currentSeason
    ? seasonRows.find((row) => row.seasonId === currentSeason.id)
    : undefined;
  const currentTeam = liveMembership?.team ?? (currentSeason ? null : player.team);
  const currentTeamId = liveMembership
    ? liveMembership.teamId
    : currentSeason
      ? null
      : player.teamId;
  const currentCaptain = liveMembership
    ? liveMembership.isCaptain
    : currentSeason
      ? false
      : player.isCaptain;
  const currentRosterRole = liveMembership
    ? liveMembership.rosterRole
    : currentSeason
      ? null
      : player.rosterRole;

  const { discordId: _discordId, discordName: _discordName, ...publicPlayer } =
    player;

  return {
    ...publicPlayer,
    team: currentTeam,
    teamId: currentTeamId,
    isCaptain: currentCaptain,
    rosterRole: currentRosterRole,
    matchPlayers,
    seasonHistory: seasonRows.map((row) => ({
      seasonId: row.season.id,
      number: row.season.number,
      name: row.season.name,
      status: row.season.status,
      teamId: row.team?.id ?? null,
      teamName: row.team?.name ?? null,
      isCaptain: row.isCaptain,
      rosterRole: row.rosterRole,
      live: currentSeason?.id === row.season.id,
    })),
    currentSeason: currentSeason
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
    include: {
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
      radiantMatches: {
        where: publicMatchWhere,
        include: {
          radiantTeam: teamRefSelect,
          direTeam: teamRefSelect,
          winnerTeam: teamRefSelect,
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      direMatches: {
        where: publicMatchWhere,
        include: {
          radiantTeam: teamRefSelect,
          direTeam: teamRefSelect,
          winnerTeam: teamRefSelect,
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
    },
  });
  return team;
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
      players: { include: { player: { select: { id: true, steamName: true } } } },
    },
  });
  return match;
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
  return { name: player.steamName, teamName: player.team?.name ?? null };
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
