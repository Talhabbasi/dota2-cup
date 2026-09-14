import { prisma } from "./prisma";
import { getNextScheduledFixture } from "./schedule";
import { parseRolesJson } from "./roles";
import { ROLE_LABELS, basePriceFor, type PlayerRole } from "./constants";

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
  const players = await prisma.player.findMany({
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
    },
    orderBy: [{ teamId: "asc" }, { steamName: "asc" }],
  });
  return players.map((p) => ({
    ...p,
    roles: parseRolesJson(p.rolesJson),
    basePrice: basePriceFor(p.medal),
  }));
}

export async function getPlayer(id: string) {
  const player = await prisma.player.findUnique({
    where: { id },
    include: { team: { select: { id: true, name: true } } },
  });
  if (!player) return null;

  const matchPlayers = await prisma.matchPlayer.findMany({
    where: {
      OR: [{ playerId: player.id }, { steam32: player.steam32 }],
    },
    include: {
      match: {
        include: {
          radiantTeam: teamRefSelect,
          direTeam: teamRefSelect,
          winnerTeam: teamRefSelect,
        },
      },
    },
    orderBy: { match: { createdAt: "desc" } },
  });

  const { discordId: _discordId, discordName: _discordName, ...publicPlayer } =
    player;

  return {
    ...publicPlayer,
    matchPlayers,
    roles: parseRolesJson(player.rolesJson),
    basePrice: basePriceFor(player.medal),
  };
}

export async function getTeams() {
  return prisma.team.findMany({
    select: {
      id: true,
      name: true,
      purse: true,
      groupKey: true,
      players: {
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
  return prisma.team.count();
}

export async function getTeam(id: string) {
  return prisma.team.findUnique({
    where: { id },
    include: {
      players: {
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
        include: {
          radiantTeam: teamRefSelect,
          direTeam: teamRefSelect,
          winnerTeam: teamRefSelect,
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      direMatches: {
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
}

export async function getMatches() {
  return prisma.match.findMany({
    select: matchListSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function getRecentMatches(take = 5) {
  return prisma.match.findMany({
    select: matchListSelect,
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function getMatchCount() {
  return prisma.match.count();
}

export async function getMatch(id: string) {
  return prisma.match.findUnique({
    where: { id },
    include: {
      radiantTeam: teamRefSelect,
      direTeam: teamRefSelect,
      winnerTeam: teamRefSelect,
      players: { include: { player: { select: { id: true, steamName: true } } } },
    },
  });
}

export async function getStandings() {
  const [teams, decided] = await Promise.all([
    prisma.team.findMany({
      select: { id: true, name: true, purse: true },
      orderBy: { name: "asc" },
    }),
    prisma.match.findMany({
      where: { winnerTeamId: { not: null } },
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
