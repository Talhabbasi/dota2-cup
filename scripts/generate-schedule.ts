import "../bot/load-env";

import { prisma } from "../src/lib/prisma";
import { formatScheduleWhen, generateWeekendSchedule } from "../src/lib/schedule";

async function main() {
  const result = await generateWeekendSchedule({ force: true });
  console.log(`Scheduled ${result.matchCount} matches for ${result.teamCount} teams`);
  console.log(`First weekend: ${formatScheduleWhen(result.firstFriday)}`);
  for (const fixture of result.fixtures) {
    console.log(
      `  ${formatScheduleWhen(fixture.scheduledAt)} — ${fixture.radiantName} vs ${fixture.direName}`,
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
