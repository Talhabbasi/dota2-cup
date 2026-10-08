import { rosterRules, type RosterRules } from "./games";
import { prisma } from "./prisma";
import { getLiveSeason } from "./seasons";

type Db = typeof prisma;

export async function liveRoster(db: Db = prisma): Promise<RosterRules> {
  const season = await getLiveSeason(db);
  return rosterRules(season);
}
