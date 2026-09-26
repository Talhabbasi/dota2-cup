import { prisma } from "./prisma";
import { currentSeasonId, syncSeasonPlayer } from "./seasons";
import { rebalanceTeamRoster } from "./players-admin";
import { STARTING_PURSE } from "./constants";

/** Link a scoreboard seat to a registered player (OCR fix). */
export async function adminLinkMatchPlayer(input: {
  matchPlayerId: string;
  playerId: string;
}) {
  const seat = await prisma.matchPlayer.findUnique({
    where: { id: input.matchPlayerId },
  });
  if (!seat) throw new Error("Match seat not found.");

  const player = await prisma.player.findUnique({
    where: { id: input.playerId },
  });
  if (!player) throw new Error("Player not found.");

  return prisma.matchPlayer.update({
    where: { id: seat.id },
    data: {
      playerId: player.id,
      steam32: player.steam32 || seat.steam32,
      unknown: false,
      asStandIn: false,
    },
  });
}

/**
 * Mark a seat as a stand-in: keep board name, clear player link.
 * Use when they are a guest, not an OCR miss to fix later.
 */
export async function adminMarkMatchStandIn(matchPlayerId: string) {
  const seat = await prisma.matchPlayer.findUnique({
    where: { id: matchPlayerId },
  });
  if (!seat) throw new Error("Match seat not found.");

  return prisma.matchPlayer.update({
    where: { id: seat.id },
    data: {
      playerId: null,
      unknown: true,
      asStandIn: true,
    },
  });
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

  const winnerTeamId =
    input.winnerSide === "radiant"
      ? input.radiantTeamId
      : input.winnerSide === "dire"
        ? input.direTeamId
        : null;

  return prisma.match.update({
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
}

export async function adminGetMatch(matchId: string) {
  return prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
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
          player: { select: { id: true, steamName: true } },
        },
        orderBy: [{ side: "asc" }, { kills: "desc" }],
      },
    },
  });
}

export async function adminListRecentMatches(take = 40) {
  const seasonId = await currentSeasonId();
  return prisma.match.findMany({
    where: { seasonId },
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
  if (!Number.isFinite(input.soldPrice) || input.soldPrice < 0) {
    throw new Error("Sold price must be a non-negative number.");
  }
  const lot = await prisma.auctionLot.findUnique({
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

  await prisma.$transaction([
    prisma.auctionLot.update({
      where: { id: lot.id },
      data: { soldPrice: next },
    }),
    prisma.team.update({
      where: { id: lot.teamId },
      data: { purse: { decrement: delta } },
    }),
  ]);

  return { lotId: lot.id, previous, next };
}

export async function adminListSoldLots() {
  const seasonId = await currentSeasonId();
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
  steam: string;
  medal: string;
  role: string;
  playWindow: string;
  displayName?: string;
}) {
  const { registerPlayer } = await import("./register");
  const stamp = Date.now();
  return registerPlayer({
    discordId: `admin-web:${stamp}`,
    discordName: input.displayName?.trim() || `Admin add ${stamp}`,
    steam: input.steam,
    medal: input.medal,
    role: input.role,
    playWindow: input.playWindow,
  });
}

export async function adminListPlayersForPicker() {
  const seasonId = await currentSeasonId();
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

export async function adminListTeamsForPicker() {
  const seasonId = await currentSeasonId();
  return prisma.team.findMany({
    where: { seasonId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      purse: true,
      captainId: true,
      players: {
        select: {
          id: true,
          steamName: true,
          discordId: true,
          isCaptain: true,
          rosterRole: true,
        },
        orderBy: [{ isCaptain: "desc" }, { steamName: "asc" }],
      },
    },
  });
}

export { syncSeasonPlayer, rebalanceTeamRoster, STARTING_PURSE };
