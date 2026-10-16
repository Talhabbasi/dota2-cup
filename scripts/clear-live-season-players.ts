import "../bot/load-env";

import { prisma } from "../src/lib/prisma";
import { getLiveSeason } from "../src/lib/seasons";

/**
 * Remove leaked SeasonPlayer rows on the live cup (bot backfill copied S1 into S2).
 * Real Season 2 registrations happen via /register or /player register after this.
 */
async function main() {
  const live = await getLiveSeason();
  if (!live) {
    console.log("No live season — nothing to clear.");
    return;
  }

  const deleted = await prisma.seasonPlayer.deleteMany({
    where: { seasonId: live.id },
  });

  // Clear legacy Player mirrors so lists don't show last season's team/fee.
  await prisma.player.updateMany({
    data: {
      teamId: null,
      isCaptain: false,
      rosterRole: null,
      teamJoinedAt: null,
      auctionStatus: "UNSOLD",
      paidAt: null,
      paymentAmount: 0,
    },
  });

  console.log(
    `Cleared ${deleted.count} SeasonPlayer row(s) from live Season ${live.number} (${live.name}).`,
  );
  console.log("Site /players will only show people who register for this season.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await prisma.$disconnect();
    process.exit(1);
  });
