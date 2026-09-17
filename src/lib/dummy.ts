import type { Prisma } from "@prisma/client";

export const DUMMY_PLAYER_PREFIX = "test-dummy-";
export const DUMMY_TEAM_PLAYER_PREFIX = "test-dummy-team-";
export const DUMMY_CAPTAIN_PREFIX = "test-dummy";

export function isDummyDiscordId(discordId: string) {
  return (
    discordId.startsWith(DUMMY_PLAYER_PREFIX) ||
    discordId.startsWith(DUMMY_TEAM_PLAYER_PREFIX)
  );
}

export function isDummyTeam(team: { name: string; captainId: string }) {
  return (
    team.captainId.startsWith(DUMMY_CAPTAIN_PREFIX) ||
    team.name.startsWith("Test ")
  );
}

export function isLiveCupTeam(team: { name: string; captainId: string }) {
  return !isDummyTeam(team);
}

export const publicPlayerWhere: Prisma.PlayerWhereInput = {
  AND: [
    { discordId: { not: { startsWith: DUMMY_PLAYER_PREFIX } } },
    { discordId: { not: { startsWith: DUMMY_TEAM_PLAYER_PREFIX } } },
  ],
};

export const publicTeamWhere: Prisma.TeamWhereInput = {
  AND: [
    { captainId: { not: { startsWith: DUMMY_CAPTAIN_PREFIX } } },
    { NOT: { name: { startsWith: "Test " } } },
  ],
};

export const publicMatchWhere: Prisma.MatchWhereInput = {
  AND: [
    { OR: [{ radiantTeamId: null }, { radiantTeam: publicTeamWhere }] },
    { OR: [{ direTeamId: null }, { direTeam: publicTeamWhere }] },
  ],
};

export const publicFixtureWhere: Prisma.ScheduledFixtureWhereInput = {
  AND: [{ radiantTeam: publicTeamWhere }, { direTeam: publicTeamWhere }],
};

export const publicAuctionLotWhere: Prisma.AuctionLotWhereInput = {
  AND: [
    { player: publicPlayerWhere },
    { OR: [{ teamId: null }, { team: publicTeamWhere }] },
  ],
};
