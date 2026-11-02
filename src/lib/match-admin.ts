import { withAuctionLock, requireAuctionInactive } from "./auction-lock";
import { prisma } from "./prisma";
import { currentSeasonId, getLiveSeason, syncSeasonPlayer } from "./seasons";
import { rebalanceTeamRoster } from "./players-admin";
import { STARTING_PURSE } from "./constants";
import { addPlayerAlias, normalizeAlias } from "./player-aliases";
import { forgetStandInBoardName } from "./scoreboard-names";
import { representedTeamId } from "./stand-in";

async function seasonTeamForSeat(
  seasonId: string | null,
  playerId: string,
  side: string,
  radiantTeamId: string | null,
  direTeamId: string | null,
) {
  const membership = seasonId
    ? await prisma.seasonPlayer.findUnique({
        where: { seasonId_playerId: { seasonId, playerId } },
        select: { teamId: true },
      })
    : null;
  return {
    originalTeamId: membership?.teamId ?? null,
    representedTeamId: representedTeamId(side, radiantTeamId, direTeamId),
  };
}

/** Link a scoreboard seat to a registered player. Other matches stay as they are. */
export async function adminLinkMatchPlayer(input: {
  matchPlayerId: string;
  playerId: string;
}) {
  const seat = await prisma.matchPlayer.findUnique({
    where: { id: input.matchPlayerId },
    include: {
      match: {
        select: { seasonId: true, radiantTeamId: true, direTeamId: true },
      },
    },
  });
  if (!seat) throw new Error("Match seat not found.");

  const player = await prisma.player.findUnique({
    where: { id: input.playerId },
  });
  if (!player) throw new Error("Player not found.");

  const boardName = seat.boardName.trim();
  // A one-letter or symbol-only scoreboard name must not block the link.
  if (normalizeAlias(boardName).length >= 2) {
    await addPlayerAlias({ playerId: player.id, alias: boardName });
  }

  const teams = await seasonTeamForSeat(
    seat.match.seasonId,
    player.id,
    seat.side,
    seat.match.radiantTeamId,
    seat.match.direTeamId,
  );
  const asStandIn = Boolean(
    teams.originalTeamId &&
      teams.representedTeamId &&
      teams.originalTeamId !== teams.representedTeamId,
  );

  await prisma.matchPlayer.update({
    where: { id: seat.id },
    data: {
      playerId: player.id,
      steam32: player.steam32 || seat.steam32,
      unknown: false,
      asStandIn,
    },
  });

  return {
    seatId: seat.id,
    alsoFixed: 0,
    boardName,
    playerName: player.steamName || player.discordName,
  };
}

/**
 * Mark this seat only. A registered player on their own team cannot be a stand-in.
 * Their other matches are left untouched.
 */
export async function adminMarkMatchStandIn(matchPlayerId: string) {
  const seat = await prisma.matchPlayer.findUnique({
    where: { id: matchPlayerId },
    include: {
      match: {
        select: { seasonId: true, radiantTeamId: true, direTeamId: true },
      },
    },
  });
  if (!seat) throw new Error("Match seat not found.");

  const teams = seat.playerId
    ? await seasonTeamForSeat(
        seat.match.seasonId,
        seat.playerId,
        seat.side,
        seat.match.radiantTeamId,
        seat.match.direTeamId,
      )
    : { originalTeamId: null, representedTeamId: null };

  if (
    seat.playerId &&
    teams.originalTeamId &&
    teams.representedTeamId &&
    teams.originalTeamId === teams.representedTeamId
  ) {
    throw new Error(
      "This player is on their own team in this match, so it is not a stand-in.",
    );
  }

  const keepLink = Boolean(seat.playerId);
  await prisma.matchPlayer.update({
    where: { id: seat.id },
    data: {
      asStandIn: true,
      unknown: !keepLink,
      ...(keepLink ? {} : { playerId: null }),
    },
  });

  return { seatId: seat.id, alsoFixed: 0, boardName: seat.boardName.trim() };
}

/**
 * Clear stand-in on this seat only. A player who represented another team stays
 * a stand-in. Forgetting a remembered board name does not edit other matches.
 */
export async function adminClearMatchStandIn(matchPlayerId: string) {
  const seat = await prisma.matchPlayer.findUnique({
    where: { id: matchPlayerId },
    include: {
      match: {
        select: { seasonId: true, radiantTeamId: true, direTeamId: true },
      },
    },
  });
  if (!seat) throw new Error("Match seat not found.");
  if (!seat.asStandIn) {
    throw new Error("That seat is not marked as a stand-in.");
  }

  const teams = seat.playerId
    ? await seasonTeamForSeat(
        seat.match.seasonId,
        seat.playerId,
        seat.side,
        seat.match.radiantTeamId,
        seat.match.direTeamId,
      )
    : { originalTeamId: null, representedTeamId: null };
  if (
    seat.playerId &&
    teams.originalTeamId &&
    teams.representedTeamId &&
    teams.originalTeamId !== teams.representedTeamId
  ) {
    throw new Error(
      "This player represented another team in this match, so the stand-in stays.",
    );
  }

  const boardName = seat.boardName.trim();
  if (boardName) {
    await forgetStandInBoardName(boardName);
  }

  await prisma.matchPlayer.update({
    where: { id: seat.id },
    data: {
      asStandIn: false,
      unknown: !seat.playerId,
    },
  });

  return { seatId: seat.id, alsoFixed: 0, boardName };
}

/** Set which franchises played and who won (fixes table “played” count). */
export async function adminSetMatchTeams(input: {
  matchId: string;
  radiantTeamId: string | null;
  direTeamId: string | null;
  winnerSide: "radiant" | "dire" | null;
}) {
  const match = await prisma.match.findUnique({ where: { id: input.matchId } });
  if (!match) throw new Error("Match not found.");

  for (const teamId of [input.radiantTeamId, input.direTeamId]) {
    if (!teamId) continue;
    const team = await prisma.team.findFirst({
      where: { id: teamId, seasonId: match.seasonId },
      select: { id: true },
    });
    if (!team) {
      throw new Error("Both teams must belong to this match's season.");
    }
  }

  const winnerTeamId =
    input.winnerSide === "radiant"
      ? input.radiantTeamId
      : input.winnerSide === "dire"
        ? input.direTeamId
        : null;

  const updated = await prisma.match.update({
    where: { id: match.id },
    data: {
      radiantTeamId: input.radiantTeamId,
      direTeamId: input.direTeamId,
      winnerTeamId,
      radiantWin:
        input.winnerSide == null
          ? null
          : input.winnerSide === "radiant",
    },
  });

  if (
    winnerTeamId &&
    (winnerTeamId === input.radiantTeamId || winnerTeamId === input.direTeamId)
  ) {
    const fixture = await prisma.scheduledFixture.findFirst({
      where: { matchId: match.id },
      select: { id: true },
    });
    if (fixture) {
      const { rescoreFixtureForWinner } = await import("./predictions");
      await rescoreFixtureForWinner(fixture.id, winnerTeamId);
    }
  }

  return updated;
}

export async function adminGetMatch(matchId: string) {
  return prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      seasonId: true,
      createdAt: true,
      radiantScore: true,
      direScore: true,
      radiantWin: true,
      screenshotPath: true,
      radiantTeam: { select: { id: true, name: true } },
      direTeam: { select: { id: true, name: true } },
      winnerTeam: { select: { id: true, name: true } },
      players: {
        select: {
          id: true,
          side: true,
          boardName: true,
          unknown: true,
          asStandIn: true,
          hero: true,
          playerId: true,
          kills: true,
          deaths: true,
          assists: true,
          player: { select: { id: true, steamName: true } },
        },
        orderBy: [{ side: "asc" }, { kills: "desc" }],
      },
    },
  });
}

export async function adminListRecentMatches(take = 40, seasonId?: string | null) {
  const resolved =
    seasonId?.trim() ||
    (await getLiveSeason())?.id ||
    (await currentSeasonId().catch(() => null));
  if (!resolved) return [];

  return prisma.match.findMany({
    where: { seasonId: resolved },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      createdAt: true,
      radiantScore: true,
      direScore: true,
      radiantWin: true,
      radiantTeam: { select: { id: true, name: true } },
      direTeam: { select: { id: true, name: true } },
      winnerTeam: { select: { id: true, name: true } },
      players: {
        select: {
          id: true,
          side: true,
          boardName: true,
          unknown: true,
          asStandIn: true,
          hero: true,
          playerId: true,
          player: { select: { id: true, steamName: true } },
        },
        orderBy: [{ side: "asc" }, { kills: "desc" }],
      },
    },
  });
}

export async function adminGetSoldLot(lotId: string) {
  return prisma.auctionLot.findUnique({
    where: { id: lotId },
    include: {
      player: { select: { id: true, steamName: true } },
      team: { select: { id: true, name: true, purse: true } },
    },
  });
}

export async function adminSetAuctionSoldPrice(input: {
  lotId: string;
  soldPrice: number;
}) {
 return withAuctionLock(async db => {
 await requireAuctionInactive(db);
  if (!Number.isFinite(input.soldPrice) || input.soldPrice < 0) {
    throw new Error("Sold price must be a non-negative number.");
  }
  const lot = await db.auctionLot.findUnique({
    where: { id: input.lotId },
    include: { team: true },
  });
  if (!lot) throw new Error("Auction lot not found.");
  if (lot.status !== "sold" || !lot.teamId) {
    throw new Error("Only sold lots with a team can have the price edited.");
  }

  const previous = lot.soldPrice ?? 0;
  const next = Math.round(input.soldPrice);
  const delta = next - previous;

  if (!lot.team || lot.team.purse - delta < 0) throw new Error("This price would exceed the team budget.");
  await Promise.all([
    db.auctionLot.update({
      where: { id: lot.id },
      data: { soldPrice: next },
    }),
    db.team.update({
      where: { id: lot.teamId },
      data: { purse: { decrement: delta } },
    }),
  ]);

  return { lotId: lot.id, previous, next };

 });
}

export async function adminListSoldLots(seasonIdInput?: string | null) {
  const seasonId = seasonIdInput?.trim() || (await currentSeasonId());
  return prisma.auctionLot.findMany({
    where: { seasonId, status: "sold", teamId: { not: null } },
    orderBy: { createdAt: "desc" },
    include: {
      player: { select: { id: true, steamName: true } },
      team: { select: { id: true, name: true, purse: true } },
    },
  });
}

/** Quick register without Discord: placeholder discord id for website-only admin add. */
export async function adminRegisterPlayerBySteam(input: {
  steam?: string;
  pubgName?: string;
  medal: string;
  role: string;
  playWindow: string;
  displayName?: string;
}) {
  const { registerPlayer } = await import("./register");
  const stamp = Date.now();
  return registerPlayer({
    discordId: `admin-web:${stamp}`,
    discordName: input.displayName?.trim() || input.pubgName?.trim() || `Admin add ${stamp}`,
    steam: input.steam,
    pubgName: input.pubgName,
    medal: input.medal,
    role: input.role,
    playWindow: input.playWindow,
    bypassCapacity: true,
  });
}

export async function adminListPlayersForPicker(seasonIdInput?: string | null) {
  const seasonId = seasonIdInput?.trim() || (await currentSeasonId());
  return prisma.player.findMany({
    where: { seasons: { some: { seasonId } } },
    orderBy: { steamName: "asc" },
    select: {
      id: true,
      steamName: true,
      discordName: true,
      discordId: true,
      medal: true,
      team: { select: { name: true } },
    },
  });
}

export async function adminListTeamsForPicker(seasonId?: string | null) {
  const resolved = seasonId?.trim() || (await getLiveSeason())?.id;
  if (!resolved) return [];
  const teams = await prisma.team.findMany({
    where: { seasonId: resolved },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      tag: true,
      logoUrl: true,
      purse: true,
      captainId: true,
      // Prefer SeasonPlayer so archive seasons still show rosters after
      // Player.teamId was cleared for the live cup.
      seasonPlayers: {
        select: {
          isCaptain: true,
          rosterRole: true,
          player: {
            select: {
              id: true,
              steamName: true,
              discordId: true,
            },
          },
        },
        orderBy: [{ isCaptain: "desc" }, { player: { steamName: "asc" } }],
      },
    },
  });

  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    tag: team.tag,
    logoUrl: team.logoUrl,
    purse: team.purse,
    captainId: team.captainId,
    players: team.seasonPlayers.map((row) => ({
      id: row.player.id,
      steamName: row.player.steamName,
      discordId: row.player.discordId,
      isCaptain: row.isCaptain,
      rosterRole: row.rosterRole,
    })),
  }));
}

export { syncSeasonPlayer, rebalanceTeamRoster, STARTING_PURSE };
