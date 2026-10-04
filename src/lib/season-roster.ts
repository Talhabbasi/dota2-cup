import { prisma } from "./prisma";
import { AuctionError, requireAuctionInactive, requireAuctionSeason, withAuctionLock, type AuctionDb } from "./auction-lock";

/** Explicit roster writer. Registration's syncSeasonPlayer only updates preferences. */
export async function syncPlayerRosterToSeason(playerId: string, db: AuctionDb = prisma) {
  const season = await requireAuctionSeason(db);
  const player = await db.player.findUniqueOrThrow({ where: { id: playerId } });
  if (player.teamId) {
    const team = await db.team.findUniqueOrThrow({ where: { id: player.teamId } });
    if (team.seasonId !== season.id) throw new AuctionError("Cannot copy another season's roster.");
  }
  const membership = await db.seasonPlayer.findUnique({ where: { seasonId_playerId: { seasonId: season.id, playerId } } });
  if (!membership) throw new AuctionError("Register this player in the active season first.");
  await db.seasonPlayer.update({ where: { id: membership.id }, data: {
    teamId: player.teamId, isCaptain: player.isCaptain, rosterRole: player.rosterRole,
    teamJoinedAt: player.teamJoinedAt, medal: player.medal, rolesJson: player.rolesJson, playWindow: player.playWindow,
  } });
}

export async function createSeasonTeam(input: {
  name: string; captainDiscordId?: string | null; captainPlayerId?: string | null;
  tag?: string | null; logoUrl?: string | null; purse: number;
}) {
  return withAuctionLock(async db => {
    await requireAuctionInactive(db);
    const season = await requireAuctionSeason(db);
    const name = input.name.trim();
    if (!name || name.length > 80) throw new AuctionError("Team name must contain 1–80 characters.", 400);
    if (!Number.isSafeInteger(input.purse) || input.purse < 0 || input.purse > 2147483647) throw new AuctionError("Purse must be a non-negative whole number.", 400);
    if (await db.team.count({ where: { seasonId: season.id } }) >= season.teamCount) throw new AuctionError(`This season allows ${season.teamCount} teams.`);
    if (await db.team.findFirst({ where: { seasonId: season.id, name: { equals: name, mode: "insensitive" } } })) throw new AuctionError("This team name is already used.");
    if (!input.captainPlayerId && !input.captainDiscordId) throw new AuctionError("Pick a captain.", 400);
    const captain = await db.seasonPlayer.findFirst({ where: {
      seasonId: season.id,
      ...(input.captainPlayerId ? { playerId: input.captainPlayerId } : { player: { OR: [{ discordId: input.captainDiscordId! }, { discordId: { startsWith: `${input.captainDiscordId}:` } }] } }),
    } });
    if (!captain || captain.teamId || captain.isCaptain) throw new AuctionError("Choose an unsigned player registered in this season.");
    const team = await db.team.create({ data: { seasonId: season.id, name, captainId: captain.playerId, purse: input.purse, tag: input.tag?.trim() || null, logoUrl: input.logoUrl?.trim() || null } });
    const assignment = { teamId: team.id, isCaptain: true, rosterRole: null, teamJoinedAt: new Date() };
    await db.seasonPlayer.update({ where: { id: captain.id }, data: assignment });
    await db.player.update({ where: { id: captain.playerId }, data: { ...assignment, auctionStatus: "SOLD" } });
    return db.team.findUniqueOrThrow({ where: { id: team.id }, include: { players: true } });
  });
}
