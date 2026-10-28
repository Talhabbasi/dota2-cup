import { cache } from "react";
import { getCupFeatureSettings } from "./cup-features";
import { playerMustPay } from "./payments";
import { prisma } from "./prisma";
import { formatEntryFee } from "./registration-status";
import { getLiveSeason } from "./seasons";

export function unpaidAuctionMessage(isCaptain: boolean) {
  const fee = formatEntryFee();
  if (isCaptain) {
    return `You haven't paid the ${fee} entry fee, so the captain auction desk stays closed.`;
  }
  return `You haven't paid the ${fee} entry fee, so the auction stays closed.`;
}

/** Substitutes are free. Everyone else needs a confirmed payment unless the admin switch is on. */
export function canEnterAuctionPool(
  member: { rosterRole: string | null; paidAt: Date | null },
  unpaidAllowed: boolean,
) {
  if (unpaidAllowed) return true;
  if (!playerMustPay(member.rosterRole)) return true;
  return member.paidAt != null;
}

export const auctionPayBlockForPlayer = cache(
  async (playerId: string | null | undefined) => {
    if (!playerId) {
      return {
        blocked: false as const,
        isCaptain: false,
        message: null as string | null,
      };
    }
    const settings = await getCupFeatureSettings();
    if (settings.unpaidAuctionAllowed) {
      return {
        blocked: false as const,
        isCaptain: false,
        message: null as string | null,
      };
    }
    const season = await getLiveSeason();
    if (!season) {
      return {
        blocked: false as const,
        isCaptain: false,
        message: null as string | null,
      };
    }
    const membership = await prisma.seasonPlayer.findUnique({
      where: { seasonId_playerId: { seasonId: season.id, playerId } },
      select: { isCaptain: true, rosterRole: true, paidAt: true },
    });
    if (!membership || canEnterAuctionPool(membership, false)) {
      return {
        blocked: false as const,
        isCaptain: membership?.isCaptain ?? false,
        message: null as string | null,
      };
    }
    return {
      blocked: true as const,
      isCaptain: membership.isCaptain,
      message: unpaidAuctionMessage(membership.isCaptain),
    };
  },
);
