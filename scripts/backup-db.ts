import "../bot/load-env";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(process.cwd(), "prisma", "backups");
  await mkdir(dir, { recursive: true });

  const [
    players,
    teams,
    matches,
    matchPlayers,
    fixtures,
    auctionState,
    auctionLots,
    bids,
    payments,
    cupSettings,
    heroes,
  ] = await Promise.all([
    prisma.player.findMany(),
    prisma.team.findMany(),
    prisma.match.findMany(),
    prisma.matchPlayer.findMany(),
    prisma.scheduledFixture.findMany(),
    prisma.auctionState.findMany(),
    prisma.auctionLot.findMany(),
    prisma.bid.findMany(),
    prisma.payment.findMany(),
    prisma.cupSettings.findMany(),
    prisma.hero.findMany({ select: { id: true, slug: true, name: true } }),
  ]);

  const payload = {
    createdAt: new Date().toISOString(),
    counts: {
      players: players.length,
      teams: teams.length,
      matches: matches.length,
      matchPlayers: matchPlayers.length,
      fixtures: fixtures.length,
      auctionLots: auctionLots.length,
      bids: bids.length,
      payments: payments.length,
      heroes: heroes.length,
    },
    players,
    teams,
    matches,
    matchPlayers,
    fixtures,
    auctionState,
    auctionLots,
    bids,
    payments,
    cupSettings,
    heroes,
  };

  const file = path.join(dir, `db-before-seasons-${stamp}.json`);
  await writeFile(file, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${file}`);
  console.log(JSON.stringify(payload.counts, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
