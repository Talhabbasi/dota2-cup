import { prisma } from "./prisma";
import { publicMatchWhere, publicPlayerWhere, publicTeamWhere } from "./dummy";
import { basePriceFor } from "./constants";
import { parseRolesJson } from "./roles";
import { toIso } from "./format";
import type { GroupStandingRow } from "./group-stage-schedule";
import { classifySeatAppearance, representedTeamId } from "./stand-in";

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
          pubgName: true,
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
      pubgName: row.player.pubgName,
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

/** Match winner wins over the fixture series score, so an admin result edit updates the table. */
export function groupFixtureWinnerId(fixture: {
  radiantTeamId: string;
  direTeamId: string;
  radiantWins: number;
  direWins: number;
  match?: { winnerTeamId: string | null } | null;
}): string | null {
  const fromMatch = fixture.match?.winnerTeamId ?? null;
  if (fromMatch === fixture.radiantTeamId || fromMatch === fixture.direTeamId) {
    return fromMatch;
  }
  if (fixture.radiantWins > fixture.direWins) return fixture.radiantTeamId;
  if (fixture.direWins > fixture.radiantWins) return fixture.direTeamId;
  return null;
}

export function blankGroupStanding(team: {
  id: string;
  name: string;
}): GroupStandingRow {
  return {
    id: team.id,
    name: team.name,
    played: 0,
    wins: 0,
    losses: 0,
    points: 0,
    kills: 0,
    standInKills: 0,
    conceded: 0,
  };
}

/** Points, then wins, then kills, then kill difference, then name. */
export function compareGroupStandings(a: GroupStandingRow, b: GroupStandingRow) {
  const diffA = a.kills - a.conceded;
  const diffB = b.kills - b.conceded;
  return (
    b.points - a.points ||
    b.wins - a.wins ||
    b.kills - a.kills ||
    diffB - diffA ||
    a.name.localeCompare(b.name)
  );
}

type GroupSeatForTable = {
  side: string;
  kills: number;
  asStandIn?: boolean;
  unknown?: boolean;
  playerId?: string | null;
};

type GroupFixtureForTable = {
  radiantTeamId: string;
  direTeamId: string;
  radiantWins: number;
  direWins: number;
  match?: {
    winnerTeamId: string | null;
    players?: GroupSeatForTable[];
  } | null;
};

function orientedSide(side: string, flipped: boolean) {
  if (!flipped) return side;
  if (side === "radiant") return "dire";
  if (side === "dire") return "radiant";
  return side;
}

/** Roster links vote on whether the saved radiant/dire sides are swapped. */
export function groupMatchSidesFlipped(
  fixture: { radiantTeamId: string; direTeamId: string },
  players: GroupSeatForTable[],
  seasonTeamByPlayer: ReadonlyMap<string, string | null>,
) {
  let stay = 0;
  let flipped = 0;
  for (const seat of players) {
    if (!seat.playerId || seat.unknown) continue;
    const rosterTeam = seasonTeamByPlayer.get(seat.playerId) ?? null;
    if (
      rosterTeam !== fixture.radiantTeamId &&
      rosterTeam !== fixture.direTeamId
    ) {
      continue;
    }
    const recorded = representedTeamId(
      seat.side,
      fixture.radiantTeamId,
      fixture.direTeamId,
    );
    const opposite = representedTeamId(
      orientedSide(seat.side, true),
      fixture.radiantTeamId,
      fixture.direTeamId,
    );
    if (rosterTeam === recorded) stay += 1;
    if (rosterTeam === opposite) flipped += 1;
  }
  return flipped > stay;
}

/**
 * Roster kills and stand-in kills for one group game.
 * The combined scoreboard total is not used.
 * Roster kills go to the player's season team. Stand-in kills go to the team
 * they played for, and are not mixed into the roster total.
 */
export function groupFixtureRosterKills(
  fixture: { radiantTeamId: string; direTeamId: string },
  players: GroupSeatForTable[],
  seasonTeamByPlayer: ReadonlyMap<string, string | null>,
) {
  const flipped = groupMatchSidesFlipped(fixture, players, seasonTeamByPlayer);
  let radiantKills = 0;
  let direKills = 0;
  let radiantStandIn = 0;
  let direStandIn = 0;
  for (const seat of players) {
    const represented = representedTeamId(
      orientedSide(seat.side, flipped),
      fixture.radiantTeamId,
      fixture.direTeamId,
    );
    if (!represented) continue;
    const rosterTeam = seat.playerId
      ? (seasonTeamByPlayer.get(seat.playerId) ?? null)
      : null;
    const kind = classifySeatAppearance({
      playerId: seat.playerId,
      unknown: seat.unknown,
      asStandIn: seat.asStandIn,
      originalTeamId: rosterTeam,
      representedTeamId: represented,
    });
    const roster =
      represented === fixture.radiantTeamId ? "radiant" : represented === fixture.direTeamId ? "dire" : null;
    if (!roster) continue;
    if (kind === "standin") {
      if (roster === "radiant") radiantStandIn += seat.kills;
      else direStandIn += seat.kills;
      continue;
    }
    if (roster === "radiant") radiantKills += seat.kills;
    else direKills += seat.kills;
  }
  return { radiantKills, direKills, radiantStandIn, direStandIn };
}

export function applyGroupFixtures(
  teams: { id: string; name: string }[],
  fixtures: GroupFixtureForTable[],
  seasonTeamByPlayer: ReadonlyMap<string, string | null> = new Map(),
): GroupStandingRow[] {
  const ids = new Set(teams.map((team) => team.id));
  const rows = new Map(
    teams.map((team) => [team.id, blankGroupStanding(team)] as const),
  );

  for (const fixture of fixtures) {
    if (!ids.has(fixture.radiantTeamId) || !ids.has(fixture.direTeamId)) continue;
    const radiant = rows.get(fixture.radiantTeamId);
    const dire = rows.get(fixture.direTeamId);
    if (!radiant || !dire) continue;

    const winnerId = groupFixtureWinnerId(fixture);
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

    const score = groupFixtureRosterKills(
      fixture,
      fixture.match?.players ?? [],
      seasonTeamByPlayer,
    );
    radiant.kills += score.radiantKills;
    radiant.standInKills += score.radiantStandIn;
    radiant.conceded += score.direKills;
    dire.kills += score.direKills;
    dire.standInKills += score.direStandIn;
    dire.conceded += score.radiantKills;
  }

  return [...rows.values()].sort(compareGroupStandings);
}

const groupTableFixtureSelect = {
  radiantTeamId: true,
  direTeamId: true,
  radiantWins: true,
  direWins: true,
  match: {
    select: {
      winnerTeamId: true,
      players: {
        select: {
          side: true,
          kills: true,
          asStandIn: true,
          unknown: true,
          playerId: true,
        },
      },
    },
  },
} as const;

async function seasonRosterTeams(seasonId: string) {
  const memberships = await prisma.seasonPlayer.findMany({
    where: { seasonId },
    select: { playerId: true, teamId: true },
  });
  return new Map(
    memberships.map((row) => [row.playerId, row.teamId] as const),
  );
}

export async function loadGroupStandingsForSeason(
  seasonId: string,
  groupKey: "A" | "B",
): Promise<GroupStandingRow[]> {
  const season = seasonWhere(seasonId);
  const [teams, fixtures, seasonTeamByPlayer] = await Promise.all([
    prisma.team.findMany({
      where: { groupKey, ...publicTeamWhere, ...season },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.scheduledFixture.findMany({
      where: { kind: "group", status: "completed", ...season },
      select: groupTableFixtureSelect,
    }),
    seasonRosterTeams(seasonId),
  ]);
  return applyGroupFixtures(teams, fixtures, seasonTeamByPlayer);
}
