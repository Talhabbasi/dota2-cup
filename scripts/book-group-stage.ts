import "../bot/load-env";

import { prisma } from "../src/lib/prisma";
import {
  bookGroupStageRoundRobin,
  formatGroupStageDiscord,
} from "../src/lib/group-stage-schedule";
import { notifySiteRefresh } from "../src/lib/notify-site";

async function main() {
  const result = await bookGroupStageRoundRobin({
    saturday: "2026-09-19",
    sunday: "2026-09-20",
    force: true,
  });
  console.log(formatGroupStageDiscord(result));
  void notifySiteRefresh();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
