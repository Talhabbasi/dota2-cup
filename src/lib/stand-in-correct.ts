import { prisma } from "./prisma";
import { plannedStandInFlag, representedTeamId } from "./stand-in";

export type StandInFlagChange = {
  seatId: string;
  matchId: string;
  playerId: string;
  from: boolean;
  to: boolean;
};

export type StandInReview = {
  seatId: string;
  matchId: string;
  playerId: string | null;
  boardName: string;
  reason: string;
};

/**
 * Plan asStandIn fixes from season roster vs the team represented in that match.
 * Does not change kills, scores, winners, or player links.
 * Ambiguous seats are reported and left unchanged.
 */
export async function planStandInCorrections() {
  const seats = await prisma.matchPlayer.findMany({
    select: {
      id: true,
      matchId: true,
      playerId: true,
      asStandIn: true,
      unknown: true,
      boardName: true,
      side: true,
      match: {
        select: {
          seasonId: true,
          radiantTeamId: true,
          direTeamId: true,
        },
      },
    },
  });

  const seasonIds = [
    ...new Set(
      seats
        .map((seat) => seat.match.seasonId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const memberships =
    seasonIds.length === 0
      ? []
      : await prisma.seasonPlayer.findMany({
          where: { seasonId: { in: seasonIds } },
          select: { seasonId: true, playerId: true, teamId: true },
        });
  const originalTeam = new Map<string, string | null>(
    memberships.map((row) => [`${row.seasonId}:${row.playerId}`, row.teamId]),
  );

  const changes: StandInFlagChange[] = [];
  const review: StandInReview[] = [];

  for (const seat of seats) {
    if (!seat.playerId || seat.unknown) continue;
    const seasonId = seat.match.seasonId;
    const membershipKey = seasonId ? `${seasonId}:${seat.playerId}` : "";
    const hasMembership = Boolean(seasonId) && originalTeam.has(membershipKey);
    const originalTeamId = hasMembership
      ? (originalTeam.get(membershipKey) ?? null)
      : null;
    const sideTeamId = representedTeamId(
      seat.side,
      seat.match.radiantTeamId,
      seat.match.direTeamId,
    );
    if (!hasMembership || !originalTeamId || !sideTeamId) {
      review.push({
        seatId: seat.id,
        matchId: seat.matchId,
        playerId: seat.playerId,
        boardName: seat.boardName,
        reason: !hasMembership
          ? "No season roster row for this match"
          : !originalTeamId
            ? "Season roster has no team"
            : "Match side has no team",
      });
      continue;
    }
    const next = plannedStandInFlag({
      playerId: seat.playerId,
      unknown: seat.unknown,
      originalTeamId,
      representedTeamId: sideTeamId,
    });
    if (next == null || next === seat.asStandIn) continue;
    changes.push({
      seatId: seat.id,
      matchId: seat.matchId,
      playerId: seat.playerId,
      from: seat.asStandIn,
      to: next,
    });
  }

  return { changes, review };
}

export async function applyStandInCorrections(changes: StandInFlagChange[]) {
  let updated = 0;
  for (const change of changes) {
    const result = await prisma.matchPlayer.updateMany({
      where: { id: change.seatId, asStandIn: change.from },
      data: { asStandIn: change.to },
    });
    updated += result.count;
  }
  return updated;
}
