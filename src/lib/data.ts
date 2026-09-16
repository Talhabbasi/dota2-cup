import { prisma } from "./prisma";
import {
  isDummyDiscordId,
  publicMatchWhere,
  publicPlayerWhere,
  publicTeamWhere,
} from "./dummy";
import { getNextScheduledFixture } from "./schedule";
import { parseRolesJson } from "./roles";
import { ROLE_LABELS, basePriceFor, type PlayerRole } from "./constants";
import {
  currentSeasonFilter,
  getCurrentSeasonSafe,
} from "./seasons";

const matchListSelect = {
  id: true,
  openDotaId: true,
  duration: true,
  radiantWin: true,
  createdAt: true,
  radiantTeam: { select: { id: true, name: true } },
  direTeam: { select: { id: true, name: true } },
  winnerTeam: { select: { id: true, name: true } },
  players: { select: { side: true, kills: true } },
} as const;

const teamRefSelect = { select: { id: true, name: true } } as const;

export async function getPlayers() {
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

export async function getTeams() {
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

export async function getTeamCount() {
  const season = await currentSeasonFilter();
  return prisma.team.count({ where: { ...publicTeamWhere, ...season } });
}

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

export async function getMatches() {
  const season = await currentSeasonFilter();
  return prisma.match.findMany({
    where: { ...publicMatchWhere, ...season },
    select: matchListSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function getRecentMatches(take = 5) {
  const season = await currentSeasonFilter();
  return prisma.match.findMany({
    where: { ...publicMatchWhere, ...season },
    select: matchListSelect,
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function getMatchCount() {
  const season = await currentSeasonFilter();
  return prisma.match.count({ where: { ...publicMatchWhere, ...season } });
}

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

export async function getStandings() {
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

export function formatMatchWhen(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function formatRoles(roles: PlayerRole[]): string {
  return roles.map((r) => ROLE_LABELS[r] ?? r).join(", ");
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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
