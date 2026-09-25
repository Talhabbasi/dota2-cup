import { getCupSettings } from "./cup-settings-cache";
import { prisma } from "./prisma";
import { MEDALS, type Medal } from "./constants";

export type CupFeatureSettings = {
  auctionEnabled: boolean;
  maxMedalToApply: Medal | null;
  completeTeamRequired: boolean;
  predictionsEnabled: boolean;
};

const DEFAULTS: CupFeatureSettings = {
  auctionEnabled: true,
  maxMedalToApply: null,
  completeTeamRequired: true,
  predictionsEnabled: true,
};

export async function getCupFeatureSettings(): Promise<CupFeatureSettings> {
  const row = await getCupSettings();
  if (!row) return { ...DEFAULTS };
  const max = row.maxMedalToApply?.toLowerCase() ?? null;
  return {
    auctionEnabled: row.auctionEnabled ?? DEFAULTS.auctionEnabled,
    maxMedalToApply:
      max && (MEDALS as readonly string[]).includes(max)
        ? (max as Medal)
        : null,
    completeTeamRequired:
      row.completeTeamRequired ?? DEFAULTS.completeTeamRequired,
    predictionsEnabled:
      row.predictionsEnabled ?? DEFAULTS.predictionsEnabled,
  };
}

export async function updateCupFeatureSettings(input: {
  auctionEnabled?: boolean;
  maxMedalToApply?: Medal | null;
  completeTeamRequired?: boolean;
  predictionsEnabled?: boolean;
}) {
  const data: {
    auctionEnabled?: boolean;
    maxMedalToApply?: string | null;
    completeTeamRequired?: boolean;
    predictionsEnabled?: boolean;
  } = {};
  if (input.auctionEnabled !== undefined) {
    data.auctionEnabled = input.auctionEnabled;
  }
  if (input.maxMedalToApply !== undefined) {
    data.maxMedalToApply = input.maxMedalToApply;
  }
  if (input.completeTeamRequired !== undefined) {
    data.completeTeamRequired = input.completeTeamRequired;
  }
  if (input.predictionsEnabled !== undefined) {
    data.predictionsEnabled = input.predictionsEnabled;
  }

  const row = await prisma.cupSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      auctionEnabled: input.auctionEnabled ?? DEFAULTS.auctionEnabled,
      maxMedalToApply: input.maxMedalToApply ?? null,
      completeTeamRequired:
        input.completeTeamRequired ?? DEFAULTS.completeTeamRequired,
      predictionsEnabled:
        input.predictionsEnabled ?? DEFAULTS.predictionsEnabled,
    },
    update: data,
  });
  const { notifySiteRefresh } = await import("./notify-site");
  void notifySiteRefresh();
  return row;
}

/** Returns an error message if this medal is above the cup max, else null. */
export async function medalBlockedByMaxRank(
  medal: string,
): Promise<string | null> {
  const { maxMedalToApply } = await getCupFeatureSettings();
  if (!maxMedalToApply) return null;
  const rank = (MEDALS as readonly string[]).indexOf(medal.toLowerCase());
  const maxRank = (MEDALS as readonly string[]).indexOf(maxMedalToApply);
  if (rank < 0 || maxRank < 0) return null;
  // MEDALS is high→low; smaller index = higher rank.
  if (rank < maxRank) {
    return `This cup only accepts **${maxMedalToApply}** and below. **${medal}** is too high.`;
  }
  return null;
}
