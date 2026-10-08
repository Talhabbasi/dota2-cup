import { createSeasonTeam } from "./season-roster";
import { withAuctionLock, requireAuctionInactive } from "./auction-lock";

export async function adminCreateManualTeam(input: {
  name: string;
  tag?: string | null;
  logoUrl?: string | null;
  captainDiscordId?: string | null;
  captainPlayerId?: string | null;
  purse?: number;
}) {
  return createSeasonTeam({ ...input, purse: input.purse ?? 0 });
}

export async function adminUpdateTeamMeta(input: {
  teamId: string;
  tag?: string | null;
  logoUrl?: string | null;
  name?: string | null;
}) {
  return withAuctionLock(async db => {
    await requireAuctionInactive(db);
  const data: { tag?: string | null; logoUrl?: string | null; name?: string } = {};
  if (input.tag !== undefined) data.tag = input.tag?.trim() || null;
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl?.trim() || null;
  if (input.name?.trim()) data.name = input.name.trim();
  return db.team.update({
    where: { id: input.teamId },
    data,
  });
  });
}

export async function adminSetPlayerAuctionMeta(input: {
  playerId: string;
  auctionStatus?: string;
  basePrice?: number | null;
}) {
  return withAuctionLock(async db => {
    await requireAuctionInactive(db);
  const data: { auctionStatus?: string; basePrice?: number | null } = {};
  if (input.auctionStatus && !["UNSOLD", "SOLD"].includes(input.auctionStatus)) throw new Error("Invalid player auction status.");
  if (input.auctionStatus) data.auctionStatus = input.auctionStatus;
  if (input.basePrice != null && (!Number.isSafeInteger(input.basePrice) || input.basePrice < 1 || input.basePrice > 2147483647)) throw new Error("Base price must be a positive whole number.");
  if (input.basePrice !== undefined) data.basePrice = input.basePrice;
  return db.player.update({
    where: { id: input.playerId },
    data,
  });
  });
}
