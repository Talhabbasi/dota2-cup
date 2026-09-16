import "../bot/load-env";

import { backfillSeason1, formatSeasonLabel } from "../src/lib/seasons";
import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await backfillSeason1();
  console.log(`Current: ${formatSeasonLabel(result.season)}`);
  console.log("Copied existing rows onto Season 1 (nothing deleted):");
  console.log(JSON.stringify(result.copied, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
