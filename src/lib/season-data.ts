import { prisma } from "./prisma";
import { publicMatchWhere, publicPlayerWhere, publicTeamWhere } from "./dummy";
import { basePriceFor } from "./constants";
import { parseRolesJson } from "./roles";
import { toIso } from "./format";
import type { GroupStandingRow } from "./group-stage-schedule";

const seasonWhere = (seasonId: string) => ({ seasonId });

export async function loadPlayersForSeason(seasonId: string) {
  if (!seasonId || seasonId === "__none__") return [];

  const rows = await prisma.seasonPlayer.findMany({
    where: {
      seasonId,
      player: publicPlayerWhere,
    },
    select: {
      teamId: true,
      isCaptain: true,
      rosterRole: true,
      medal: true,
      rolesJson: true,
      playWindow: true,
      team: { select: { id: true, name: true } },
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
    orderBy: [{ team: { name: "asc" } }, { player: { steamName: "asc" } }],
  });

  return rows.map((row) => {
    const medal = row.medal ?? row.player.medal;
    const rolesJson = row.rolesJson ?? row.player.rolesJson;
    return {
      id: row.player.id,
      steamName: row.player.steamName,
      medal,
      playWindow: row.playWindow ?? row.player.playWindow,
      createdAt: toIso(row.player.createdAt),
      team: row.team,
      teamId: row.teamId,
      isCaptain: row.isCaptain,
      rosterRole: row.rosterRole,
      roles: parseRolesJson(rolesJson),
      basePrice: basePriceFor(medal),
    };
  });
}

export async function loadTeamsForSeason(seasonId: string) {
  if (!seasonId || seasonId === "__none__") return [];

  const teams = await prisma.team.findMany({
    where: { ...publicTeamWhere, ...seasonWhere(seasonId) },
    select: {
      id: true,
      name: true,
      purse: true,
      groupKey: true,
      seasonPlayers: {
        where: { player: publicPlayerWhere },
        select: {
          isCaptain: true,
          rosterRole: true,
          player: { select: { id: true, steamName: true } },
        },
        orderBy: [{ isCaptain: "desc" }, { player: { steamName: "asc" } }],
      },
    },
    orderBy: { name: "asc" },
  });

  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    purse: team.purse,
    groupKey: team.groupKey,
    players: team.seasonPlayers.map((row) => ({
      id: row.player.id,
      steamName: row.player.steamName,
      isCaptain: row.isCaptain,
      rosterRole: row.rosterRole,
    })),
  }));
}

export async function loadStandingsForSeason(seasonId: string) {
  const season = seasonWhere(seasonId);
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

export async function loadMatchesForSeason(seasonId: string) {
  return prisma.match.findMany({
    where: { ...publicMatchWhere, ...seasonWhere(seasonId) },
    select: {
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
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function loadGroupStandingsForSeason(
  seasonId: string,
  groupKey: "A" | "B",
): Promise<GroupStandingRow[]> {
  const season = seasonWhere(seasonId);
  const [teams, fixtures] = await Promise.all([
    prisma.team.findMany({
      where: { groupKey, ...publicTeamWhere, ...season },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.scheduledFixture.findMany({
      where: { kind: "group", status: "completed", ...season },
      include: { match: true },
    }),
  ]);
  const ids = new Set(teams.map((team) => team.id));
  const rows = new Map<string, GroupStandingRow>(
    teams.map((team) => [
      team.id,
      { id: team.id, name: team.name, played: 0, wins: 0, losses: 0, points: 0 },
    ]),
  );

  for (const fixture of fixtures) {
    if (!ids.has(fixture.radiantTeamId) || !ids.has(fixture.direTeamId)) continue;
    const radiant = rows.get(fixture.radiantTeamId);
    const dire = rows.get(fixture.direTeamId);
    if (!radiant || !dire) continue;

    let winnerId: string | null = null;
    if (fixture.radiantWins > fixture.direWins) winnerId = fixture.radiantTeamId;
    else if (fixture.direWins > fixture.radiantWins) winnerId = fixture.direTeamId;
    else if (fixture.match?.winnerTeamId) winnerId = fixture.match.winnerTeamId;
    if (!winnerId) continue;

    radiant.played += 1;
    dire.played += 1;
    if (winnerId === radiant.id) {
      radiant.wins += 1;
      radiant.points += 1;
      dire.losses += 1;
    } else {
      dire.wins += 1;
      dire.points += 1;
      radiant.losses += 1;
    }
  }

  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      a.name.localeCompare(b.name),
  );
}
