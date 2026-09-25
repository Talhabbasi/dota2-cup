import { prisma } from "./prisma";
import { currentSeasonId } from "./seasons";
import { ROLE_LABELS, type PlayerRole } from "./constants";
import { parseRolesJson } from "./roles";
import { formatPoints } from "./constants";

export type InsightLeader = {
  name: string;
  teamName: string | null;
  value: number;
  detail?: string;
  /** Roster vs stand-in — same person on two teams stays two rows. */
  kind?: "roster" | "standin";
};

type Agg = {
  name: string;
  teamName: string | null;
  value: number;
  kind: "roster" | "standin";
};

export type AdminInsights = {
  matchesPlayed: number;
  matchesWithWinner: number;
  standInSeats: number;
  unmatchedSeats: number;
  linkedSeats: number;
  registeredPlayers: number;
  signedPlayers: number;
  roleBreakdown: { role: string; label: string; count: number }[];
  /** Roster + stand-in rows keyed separately (never merge across teams). */
  topKills: InsightLeader[];
  topAssists: InsightLeader[];
  topDeaths: InsightLeader[];
  mostGames: InsightLeader[];
  highestGpm: InsightLeader[];
  mostPickedHeroes: InsightLeader[];
  topTeamKills: InsightLeader[];
  topTeamDeaths: InsightLeader[];
  /** Kept for callers; same source as main boards, stand-in only. */
  standInTopKills: InsightLeader[];
  standInTopAssists: InsightLeader[];
  standInMostGames: InsightLeader[];
  highestBid: InsightLeader | null;
  highestSold: InsightLeader | null;
  avgSoldPrice: number | null;
  soldCount: number;
};

function topN(map: Map<string, Agg>, n: number): InsightLeader[] {
  return [...map.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, n)
    .map((row) => ({
      name: row.name,
      teamName: row.teamName,
      value: row.value,
      kind: row.kind,
      detail: row.kind === "standin" ? "Stand-in" : undefined,
    }));
}

function bump(
  map: Map<string, Agg>,
  key: string,
  name: string,
  teamName: string | null,
  kind: "roster" | "standin",
  add: number,
) {
  const cur = map.get(key) ?? { name, teamName, value: 0, kind };
  cur.value += add;
  cur.name = name;
  cur.teamName = teamName;
  cur.kind = kind;
  map.set(key, cur);
}

function matchTeamName(seat: {
  side: string;
  match: {
    radiantTeam: { name: string } | null;
    direTeam: { name: string } | null;
  };
}): string | null {
  return seat.side === "radiant"
    ? seat.match.radiantTeam?.name ?? null
    : seat.match.direTeam?.name ?? null;
}

export async function getAdminInsights(): Promise<AdminInsights> {
  const seasonId = await currentSeasonId();

  const [matches, seats, players, bids, lots] = await Promise.all([
    prisma.match.findMany({
      where: { seasonId },
      select: { id: true, winnerTeamId: true },
    }),
    prisma.matchPlayer.findMany({
      where: { match: { seasonId } },
      select: {
        kills: true,
        assists: true,
        deaths: true,
        gpm: true,
        hero: true,
        unknown: true,
        asStandIn: true,
        playerId: true,
        boardName: true,
        side: true,
        match: {
          select: {
            radiantTeam: { select: { name: true } },
            direTeam: { select: { name: true } },
          },
        },
        player: {
          select: {
            steamName: true,
            team: { select: { name: true } },
          },
        },
      },
    }),
    prisma.player.findMany({
      where: { seasons: { some: { seasonId } } },
      select: {
        steamName: true,
        rolesJson: true,
        teamId: true,
        discordId: true,
      },
    }),
    prisma.bid.findMany({
      where: { lot: { seasonId } },
      orderBy: { amount: "desc" },
      take: 1,
      select: {
        amount: true,
        team: { select: { name: true } },
        player: { select: { steamName: true } },
        lot: { select: { player: { select: { steamName: true } } } },
      },
    }),
    prisma.auctionLot.findMany({
      where: { seasonId, status: "sold", soldPrice: { not: null } },
      select: {
        soldPrice: true,
        player: { select: { steamName: true } },
        team: { select: { name: true } },
      },
    }),
  ]);

  const realPlayers = players.filter(
    (p) =>
      !p.discordId.startsWith("test-dummy-") &&
      !p.discordId.startsWith("test-dummy-team-"),
  );

  const roleCounts = new Map<string, number>();
  for (const p of realPlayers) {
    const roles = parseRolesJson(p.rolesJson);
    if (roles.length === 0) {
      roleCounts.set("unknown", (roleCounts.get("unknown") ?? 0) + 1);
      continue;
    }
    for (const role of roles) {
      roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
    }
  }

  const kills = new Map<string, Agg>();
  const assists = new Map<string, Agg>();
  const deaths = new Map<string, Agg>();
  const games = new Map<string, Agg>();
  const gpmBest = new Map<string, Agg>();
  const heroes = new Map<string, number>();

  const standInKills = new Map<string, Agg>();
  const standInAssists = new Map<string, Agg>();
  const standInGames = new Map<string, Agg>();
  const teamKills = new Map<string, Agg>();
  const teamDeaths = new Map<string, Agg>();

  let standInSeats = 0;
  let unmatchedSeats = 0;
  let linkedSeats = 0;

  for (const seat of seats) {
    if (seat.hero) {
      heroes.set(seat.hero, (heroes.get(seat.hero) ?? 0) + 1);
    }

    const teamName = matchTeamName(seat);

    if (teamName) {
      const teamKey = `team:${teamName.toLowerCase()}`;
      bump(teamKills, teamKey, teamName, teamName, "roster", seat.kills);
      bump(teamDeaths, teamKey, teamName, teamName, "roster", seat.deaths);
    }

    if (seat.asStandIn) {
      standInSeats += 1;
      const name =
        seat.player?.steamName?.trim() ||
        seat.boardName?.trim() ||
        "Stand-in";
      const identity = seat.playerId
        ? `pid:${seat.playerId}`
        : `name:${name.toLowerCase()}`;
      const key = `standin:${identity}:${(teamName ?? "none").toLowerCase()}`;
      // Stand-in totals never merge into roster keys.
      bump(standInKills, key, name, teamName, "standin", seat.kills);
      bump(standInAssists, key, name, teamName, "standin", seat.assists);
      bump(standInGames, key, name, teamName, "standin", 1);
      bump(kills, key, name, teamName, "standin", seat.kills);
      bump(assists, key, name, teamName, "standin", seat.assists);
      bump(deaths, key, name, teamName, "standin", seat.deaths);
      bump(games, key, name, teamName, "standin", 1);
      continue;
    }

    if (seat.unknown || !seat.playerId) {
      unmatchedSeats += 1;
      continue;
    }

    linkedSeats += 1;
    const name = seat.player?.steamName || seat.boardName || "Unknown";
    // Key by player + match team so Danu roster ≠ Stoic (or any other) games.
    const key = `roster:${seat.playerId}:${(teamName ?? seat.player?.team?.name ?? "none").toLowerCase()}`;
    const displayTeam = teamName ?? seat.player?.team?.name ?? null;

    bump(kills, key, name, displayTeam, "roster", seat.kills);
    bump(assists, key, name, displayTeam, "roster", seat.assists);
    bump(deaths, key, name, displayTeam, "roster", seat.deaths);
    bump(games, key, name, displayTeam, "roster", 1);

    const gpmCur = gpmBest.get(key);
    if (!gpmCur || seat.gpm > gpmCur.value) {
      gpmBest.set(key, {
        name,
        teamName: displayTeam,
        value: seat.gpm,
        kind: "roster",
      });
    }
  }

  const topBid = bids[0]
    ? {
        name: bids[0].lot.player.steamName,
        teamName: bids[0].team.name,
        value: bids[0].amount,
        detail: `by ${bids[0].player.steamName}`,
      }
    : null;

  const highestSold =
    lots.length === 0
      ? null
      : [...lots]
          .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
          .slice(0, 1)
          .map((lot) => ({
            name: lot.player.steamName,
            teamName: lot.team?.name ?? null,
            value: lot.soldPrice ?? 0,
          }))[0] ?? null;

  const soldSum = lots.reduce((s, l) => s + (l.soldPrice ?? 0), 0);

  return {
    matchesPlayed: matches.length,
    matchesWithWinner: matches.filter((m) => m.winnerTeamId).length,
    standInSeats,
    unmatchedSeats,
    linkedSeats,
    registeredPlayers: realPlayers.length,
    signedPlayers: realPlayers.filter((p) => p.teamId).length,
    roleBreakdown: [...roleCounts.entries()]
      .map(([role, count]) => ({
        role,
        label:
          ROLE_LABELS[role as PlayerRole] ??
          (role === "unknown" ? "Unknown" : role),
        count,
      }))
      .sort((a, b) => b.count - a.count),
    topKills: topN(kills, 12),
    topAssists: topN(assists, 12),
    topDeaths: topN(deaths, 12),
    mostGames: topN(games, 12),
    highestGpm: topN(gpmBest, 5),
    mostPickedHeroes: [...heroes.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, teamName: null, value })),
    topTeamKills: topN(teamKills, 12),
    topTeamDeaths: topN(teamDeaths, 12),
    standInTopKills: topN(standInKills, 8),
    standInTopAssists: topN(standInAssists, 8),
    standInMostGames: topN(standInGames, 8),
    highestBid: topBid,
    highestSold,
    avgSoldPrice: lots.length ? Math.round(soldSum / lots.length) : null,
    soldCount: lots.length,
  };
}

export function formatInsightPoints(n: number) {
  return formatPoints(n);
}
