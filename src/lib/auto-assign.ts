import { pushDiscordRoleSync } from "@/lib/discord-role-sync-rest";
import { pushDiscordTeamRooms } from "@/lib/discord-team-rooms-rest";
import { isDummyDiscordId, isLiveCupTeam } from "@/lib/dummy";
import { labelForMedal } from "@/lib/constants";
import { syncPlayerRosterToSeason } from "@/lib/season-roster";
import { prisma } from "@/lib/prisma";
import {
  AuctionError,
  requireAuctionInactive,
  requireAuctionSeason,
  withAuctionLock,
} from "@/lib/auction-lock";
import {
  AUTO_ASSIGN_CAP,
  buildBalancedAssignment,
  rankScore,
  type BalanceTeam,
} from "@/lib/auto-assign-balance";

export type AutoAssignOverview = {
  auctionOpen: boolean;
  unpicked: number;
  eligible: number;
  unpaidExcluded: number;
  invalidRankExcluded: number;
  shortTeams: number;
  openSlots: number;
  disabledReason: string | null;
};

export type AutoAssignRow = {
  playerId: string;
  playerName: string;
  medal: string;
  rankScore: number;
  teamId: string;
  teamName: string;
  beforeCount: number;
  afterCount: number;
  beforeAverage: number | null;
  afterAverage: number | null;
};

export type AutoAssignTeamPreview = {
  teamId: string;
  teamName: string;
  beforeCount: number;
  afterCount: number;
  beforeAverage: number | null;
  afterAverage: number | null;
  full: boolean;
};

export type AutoAssignProposal = {
  seed: number;
  spread: number;
  assignments: AutoAssignRow[];
  leftOut: { playerId: string; playerName: string; medal: string; rankScore: number }[];
  teams: AutoAssignTeamPreview[];
};

type PoolPlayer = {
  id: string;
  name: string;
  medal: string;
  discordId: string;
  paid: boolean;
  rank: number | null;
  sold: boolean;
  onTeam: boolean;
};

type PoolTeam = {
  id: string;
  name: string;
  count: number;
  total: number;
  ranked: number;
};

function average(total: number, ranked: number): number | null {
  if (ranked <= 0) return null;
  return Math.round(total / ranked);
}

async function loadPool() {
  const season = await requireAuctionSeason(prisma);
  const [state, teams, members, soldLots] = await Promise.all([
    prisma.auctionState.findUnique({
      where: { id: "singleton" },
      select: { status: true },
    }),
    prisma.team.findMany({
      where: { seasonId: season.id },
      select: { id: true, name: true, captainId: true },
    }),
    prisma.seasonPlayer.findMany({
      where: { seasonId: season.id },
      select: {
        playerId: true,
        teamId: true,
        isCaptain: true,
        paidAt: true,
        medal: true,
        player: {
          select: {
            steamName: true,
            discordId: true,
            medal: true,
            teamId: true,
            auctionStatus: true,
          },
        },
      },
    }),
    prisma.auctionLot.findMany({
      where: { seasonId: season.id, status: "sold" },
      select: { playerId: true },
    }),
  ]);

  const soldIds = new Set(soldLots.map((lot) => lot.playerId));
  const liveTeams = teams.filter((team) => isLiveCupTeam(team));
  const liveIds = new Set(liveTeams.map((team) => team.id));
  const byTeam = new Map<string, PoolTeam>(
    liveTeams.map((team) => [
      team.id,
      { id: team.id, name: team.name, count: 0, total: 0, ranked: 0 },
    ]),
  );

  const unsigned: PoolPlayer[] = [];
  for (const member of members) {
    if (isDummyDiscordId(member.player.discordId)) continue;
    const medal = member.medal || member.player.medal;
    const score = rankScore(medal);
    const onThisSeasonTeam = Boolean(member.teamId && liveIds.has(member.teamId));
    if (onThisSeasonTeam && member.teamId) {
      const team = byTeam.get(member.teamId);
      if (team) {
        team.count += 1;
        if (score != null) {
          team.total += score;
          team.ranked += 1;
        }
      }
      continue;
    }
    if (member.isCaptain) continue;
    unsigned.push({
      id: member.playerId,
      name: member.player.steamName,
      medal,
      discordId: member.player.discordId,
      paid: member.paidAt != null,
      rank: score,
      sold: soldIds.has(member.playerId) || member.player.auctionStatus === "SOLD",
      onTeam: Boolean(member.player.teamId),
    });
  }

  const unpicked = unsigned.filter((player) => !player.sold && !player.onTeam);
  const eligible = unpicked.filter((player) => player.paid && player.rank != null);
  const unpaidExcluded = unpicked.filter((player) => !player.paid).length;
  const invalidRankExcluded = unpicked.filter(
    (player) => player.paid && player.rank == null,
  ).length;
  const poolTeams = [...byTeam.values()];
  const shortTeams = poolTeams.filter((team) => team.count < AUTO_ASSIGN_CAP);
  const openSlots = shortTeams.reduce(
    (sum, team) => sum + (AUTO_ASSIGN_CAP - team.count),
    0,
  );
  const auctionOpen = Boolean(state && state.status !== "idle");

  let disabledReason: string | null = null;
  if (auctionOpen) {
    disabledReason = "The live auction is still open. This does not run, and does not change bids, purses, or the current pool, until the auction is idle.";
  } else if (eligible.length === 0) {
    disabledReason = "No paid, unpicked players with a valid rank are left to assign.";
  } else if (openSlots === 0) {
    disabledReason = "Every team already has 5 players. There are no open slots.";
  }

  const overview: AutoAssignOverview = {
    auctionOpen,
    unpicked: unpicked.length,
    eligible: eligible.length,
    unpaidExcluded,
    invalidRankExcluded,
    shortTeams: shortTeams.length,
    openSlots,
    disabledReason,
  };

  return { season, overview, eligible, poolTeams };
}

export async function loadAutoAssignOverview(): Promise<AutoAssignOverview> {
  const { overview } = await loadPool();
  return overview;
}

export async function previewAutoAssign(seed: number): Promise<AutoAssignProposal> {
  const { overview, eligible, poolTeams } = await loadPool();
  if (overview.disabledReason) throw new AuctionError(overview.disabledReason, 400);
  const safeSeed = Number.isFinite(seed) ? Math.floor(Math.abs(seed)) || 1 : 1;
  const result = buildBalancedAssignment(
    eligible.map((player) => ({ id: player.id, mmr: player.rank! })),
    poolTeams.map(
      (team): BalanceTeam => ({
        id: team.id,
        count: team.count,
        total: team.total,
        ranked: team.ranked,
      }),
    ),
    safeSeed,
  );

  const teamById = new Map(poolTeams.map((team) => [team.id, team]));
  const playerById = new Map(eligible.map((player) => [player.id, player]));
  const added = new Map<string, { total: number; ranked: number; count: number }>();
  for (const team of poolTeams) {
    added.set(team.id, { total: team.total, ranked: team.ranked, count: team.count });
  }
  const assignments: AutoAssignRow[] = [];
  for (const placement of result.placements) {
    const player = playerById.get(placement.playerId);
    const team = teamById.get(placement.teamId);
    const running = added.get(placement.teamId);
    if (!player || !team || !running || player.rank == null) continue;
    const beforeCount = running.count;
    const beforeAverage = average(running.total, running.ranked);
    running.count += 1;
    running.ranked += 1;
    running.total += player.rank;
    assignments.push({
      playerId: player.id,
      playerName: player.name,
      medal: labelForMedal(player.medal),
      rankScore: player.rank,
      teamId: team.id,
      teamName: team.name,
      beforeCount,
      afterCount: running.count,
      beforeAverage,
      afterAverage: average(running.total, running.ranked),
    });
  }
  const placed = new Set(assignments.map((row) => row.playerId));
  const leftOut = eligible
    .filter((player) => !placed.has(player.id))
    .map((player) => ({
      playerId: player.id,
      playerName: player.name,
      medal: labelForMedal(player.medal),
      rankScore: player.rank!,
    }));

  return {
    seed: safeSeed,
    spread: Math.round(result.spread),
    assignments,
    leftOut,
    teams: poolTeams
      .map((team) => {
        const running = added.get(team.id)!;
        return {
          teamId: team.id,
          teamName: team.name,
          beforeCount: team.count,
          afterCount: running.count,
          beforeAverage: average(team.total, team.ranked),
          afterAverage: average(running.total, running.ranked),
          full: team.count >= AUTO_ASSIGN_CAP,
        };
      })
      .sort((a, b) => a.teamName.localeCompare(b.teamName)),
  };
}

export async function commitAutoAssign(
  placements: { playerId: string; teamId: string }[],
) {
  if (!Array.isArray(placements) || placements.length === 0) {
    throw new AuctionError("There is no assignment to save.", 400);
  }
  const seenPlayers = new Set<string>();
  for (const row of placements) {
    if (!row?.playerId || !row?.teamId) {
      throw new AuctionError("Assignment is incomplete.", 400);
    }
    if (seenPlayers.has(row.playerId)) {
      throw new AuctionError("A player was listed twice.", 400);
    }
    seenPlayers.add(row.playerId);
  }

  const gate = await prisma.auctionState.findUnique({
    where: { id: "singleton" },
    select: { status: true },
  });
  if (gate && gate.status !== "idle") {
    throw new AuctionError(
      "The live auction is still open. Auto-assign does not run during a live or paused pool.",
      409,
    );
  }

  const saved = await withAuctionLock(async (db) => {
    await requireAuctionInactive(db);
    const season = await requireAuctionSeason(db);
    const [members, teams, soldLots] = await Promise.all([
      db.seasonPlayer.findMany({
        where: { seasonId: season.id, playerId: { in: [...seenPlayers] } },
        select: {
          playerId: true,
          teamId: true,
          isCaptain: true,
          paidAt: true,
          medal: true,
          player: {
            select: {
              discordId: true,
              medal: true,
              teamId: true,
              auctionStatus: true,
              steamName: true,
            },
          },
        },
      }),
      db.team.findMany({
        where: { seasonId: season.id },
        select: {
          id: true,
          name: true,
          captainId: true,
          _count: { select: { seasonPlayers: true } },
        },
      }),
      db.auctionLot.findMany({
        where: {
          seasonId: season.id,
          status: "sold",
          playerId: { in: [...seenPlayers] },
        },
        select: { playerId: true },
      }),
    ]);

    const memberById = new Map(members.map((member) => [member.playerId, member]));
    const teamById = new Map(teams.map((team) => [team.id, team]));
    const soldIds = new Set(soldLots.map((lot) => lot.playerId));
    const incoming = new Map<string, number>();

    for (const row of placements) {
      const member = memberById.get(row.playerId);
      const team = teamById.get(row.teamId);
      if (!member || !team || !isLiveCupTeam(team)) {
        throw new AuctionError("That player or team is not in this season.", 400);
      }
      if (isDummyDiscordId(member.player.discordId)) {
        throw new AuctionError("Test players cannot be auto-assigned.", 400);
      }
      if (member.paidAt == null) {
        throw new AuctionError(
          `${member.player.steamName} is not paid. Unpaid players cannot be assigned.`,
          400,
        );
      }
      if (
        member.teamId ||
        member.player.teamId ||
        member.isCaptain ||
        soldIds.has(member.playerId) ||
        member.player.auctionStatus === "SOLD" ||
        member.player.auctionStatus === "ON_AUCTION"
      ) {
        throw new AuctionError(
          `${member.player.steamName} is already assigned or was already auctioned.`,
          400,
        );
      }
      if (rankScore(member.medal || member.player.medal) == null) {
        throw new AuctionError(
          `${member.player.steamName} does not have a valid rank score.`,
          400,
        );
      }
      incoming.set(row.teamId, (incoming.get(row.teamId) ?? 0) + 1);
    }

    for (const [teamId, adding] of incoming) {
      const team = teamById.get(teamId)!;
      if (team._count.seasonPlayers + adding > AUTO_ASSIGN_CAP) {
        throw new AuctionError(
          `${team.name} would go past ${AUTO_ASSIGN_CAP} players.`,
          400,
        );
      }
    }

    const now = new Date();
    const discordIds: string[] = [];
    const teamNames = new Set<string>();
    for (const row of placements) {
      const member = memberById.get(row.playerId)!;
      const moved = await db.seasonPlayer.updateMany({
        where: {
          seasonId: season.id,
          playerId: row.playerId,
          teamId: null,
          isCaptain: false,
          paidAt: { not: null },
        },
        data: {
          teamId: row.teamId,
          isCaptain: false,
          rosterRole: null,
          teamJoinedAt: now,
        },
      });
      if (moved.count !== 1) {
        throw new AuctionError(
          `${member.player.steamName} could not be assigned. Refresh and try again.`,
          409,
        );
      }
      const playerMoved = await db.player.updateMany({
        where: { id: row.playerId, teamId: null },
        data: {
          teamId: row.teamId,
          isCaptain: false,
          rosterRole: null,
          teamJoinedAt: now,
          auctionStatus: "SOLD",
        },
      });
      if (playerMoved.count !== 1) {
        throw new AuctionError(
          `${member.player.steamName} is already on a team.`,
          409,
        );
      }
      discordIds.push(member.player.discordId);
      teamNames.add(teamById.get(row.teamId)!.name);
    }

    for (const row of placements) {
      await syncPlayerRosterToSeason(row.playerId, db);
    }

    return {
      count: placements.length,
      discordIds,
      teamNames: [...teamNames],
    };
  });

  await pushDiscordRoleSync(saved.discordIds);
  await pushDiscordTeamRooms({ teamNames: saved.teamNames });
  return saved;
}
