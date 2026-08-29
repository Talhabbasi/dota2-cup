import "../bot/load-env";

import { adminCreateDummyTeams } from "../src/lib/players-admin";
import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await adminCreateDummyTeams(2, 5);
  for (const team of result.created) {
    console.log(`${team.name}: ${team.players.length}/7`);
    for (const player of team.players) console.log(`  - ${player}`);
  }

  const teams = await prisma.team.findMany({
    include: { players: true },
    orderBy: { name: "asc" },
  });
  console.log("\nAll teams:");
  for (const team of teams) {
    console.log(`  ${team.name}: ${team.players.length}/7`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
