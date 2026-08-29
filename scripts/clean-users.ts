import "../bot/load-env";

import { prisma } from "../src/lib/prisma";

function hasFlag(name: string) {
  return process.argv.includes(name);
}

async function main() {
  const confirmed = hasFlag("--yes");

  const [players, teams, bids, lots, fixtures, matches] = await Promise.all([
    prisma.player.count(),
    prisma.team.count(),
    prisma.bid.count(),
    prisma.auctionLot.count(),
    prisma.scheduledFixture.count(),
    prisma.match.count(),
  ]);

  console.log("This wipes cup registrations from the database.");
  console.log("Discord members are not kicked — they can /register again.\n");
  console.log(`  players:   ${players}`);
  console.log(`  teams:     ${teams}`);
  console.log(`  bids:      ${bids}`);
  console.log(`  lots:      ${lots}`);
  console.log(`  fixtures:  ${fixtures}`);
  console.log(`  matches:   ${matches}`);

  if (!confirmed) {
    console.log("\nNothing deleted. Re-run with --yes to confirm:");
    console.log("  npm run clean:users -- --yes");
    return;
  }

  await prisma.bid.deleteMany();
  await prisma.auctionLot.deleteMany();
  await prisma.scheduledFixture.deleteMany();
  await prisma.matchPlayer.deleteMany();
  await prisma.match.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.auctionState.deleteMany();
  await prisma.auctionState.create({ data: { id: "singleton" } });

  console.log("\nDone. Database is empty. Players can /register again in Discord.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
