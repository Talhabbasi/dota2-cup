import "../bot/load-env";

import { rebalanceAllTeamRosters } from "../src/lib/players-admin";
import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await rebalanceAllTeamRosters();
  const teams = await prisma.team.findMany({
    include: { players: { orderBy: [{ isCaptain: "desc" }, { createdAt: "asc" }] } },
  });
  for (const team of teams) {
    const starters = team.players.filter((p) => p.rosterRole !== "sub").length;
    const subs = team.players.filter((p) => p.rosterRole === "sub").length;
    console.log(
      `${team.name}: ${team.players.length}/7 · starters ${starters}/5 · subs ${subs}/2`,
    );
  }
  console.log(`Rebalanced ${result.teams} teams.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
