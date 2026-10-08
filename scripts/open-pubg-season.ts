import { CUP_GAME, PUBG_MODE } from "../src/lib/games";
import { prisma } from "../src/lib/prisma";
import { setRegistrationOpen } from "../src/lib/registration-status";
import { createSeasonAdmin, getLiveSeason } from "../src/lib/seasons";

async function main() {
  const auction = await prisma.auctionState.findUnique({
    where: { id: "singleton" },
  });
  if (auction && auction.status !== "idle") {
    throw new Error("Finish the live auction before switching the season.");
  }

  let season = await prisma.season.findFirst({
    where: { game: CUP_GAME.PUBG, status: { not: "archived" } },
    orderBy: { number: "desc" },
  });

  if (!season) {
    season = await createSeasonAdmin({
      name: "PUBG Cup",
      game: CUP_GAME.PUBG,
      pubgMode: PUBG_MODE.SQUAD,
      teamCount: 8,
      tournamentFormat: "AUCTION_BASED",
    });
  }

  if (!season.isActive) {
    await prisma.$transaction(async (tx) => {
      await tx.season.updateMany({ data: { isActive: false } });
      await tx.season.update({
        where: { id: season!.id },
        data: {
          isActive: true,
          status: "live",
          phase: "UPCOMING",
        },
      });
      await tx.cupSettings.upsert({
        where: { id: "singleton" },
        create: {
          id: "singleton",
          currentSeasonId: season!.id,
          registrationOpen: true,
        },
        update: { currentSeasonId: season!.id, registrationOpen: true },
      });
      await tx.player.updateMany({
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
    });
  }

  await setRegistrationOpen(true);
  const live = await getLiveSeason();
  console.log(
    JSON.stringify(
      {
        id: live?.id,
        name: live?.name,
        game: live?.game,
        pubgMode: live?.pubgMode,
        registrationOpen: true,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
