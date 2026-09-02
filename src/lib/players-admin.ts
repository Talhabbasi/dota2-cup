import {
  MAX_CAPTAINS,
  MAX_ROSTER,
  MEDALS,
  MIN_ROSTER,
  STARTING_PURSE,
  STARTING_ROLES,
  parseMedal,
} from "./constants";
import { parsePlayWindow } from "./play-window";
import { prisma } from "./prisma";
import {
  parseRegistrationRole,
  rosterRoleForTeamJoin,
  stringifyRoles,
} from "./roles";

const DUMMY_PREFIX = "test-dummy-";
const DUMMY_TEAM_PREFIX = "test-dummy-team-";
const DUMMY_TEAM_NAMES = [
  "Test Liquid",
  "Test OG",
  "Test Falcons",
  "Test Tundra",
  "Test Gaimin",
  "Test Entity",
  "Test Heroic",
];

async function requirePlayer(discordId: string) {
  const player = await prisma.player.findUnique({
    where: { discordId },
    include: { team: true },
  });
  if (!player) {
    throw new Error("That user is not registered.");
  }
  return player;
}

export async function adminDeletePlayer(discordId: string) {
  const player = await requirePlayer(discordId);
  if (player.isCaptain) {
    throw new Error("Remove the captain first with `/captain remove`.");
  }
  if (player.teamId) {
    throw new Error("Remove them from the team first with `/player remove`.");
  }

  const state = await prisma.auctionState.findUnique({
    where: { id: "singleton" },
  });
  if (state?.currentPlayerId === player.id) {
    throw new Error(
      "This player is on the auction block. Admin: `/auction skip` first.",
    );
  }

  await prisma.bid.deleteMany({ where: { playerId: player.id } });
  await prisma.auctionLot.deleteMany({ where: { playerId: player.id } });
  await prisma.matchPlayer.updateMany({
    where: { playerId: player.id },
    data: { playerId: null },
  });
  await prisma.player.delete({ where: { id: player.id } });

  return { name: player.steamName };
}

export async function adminAddPlayerToTeam(input: {
  discordId: string;
  teamName: string;
}) {
  const player = await requirePlayer(input.discordId);
  if (player.teamId) {
    throw new Error(`${player.discordName} is already on a team.`);
  }

  const team = await prisma.team.findUnique({
    where: { name: input.teamName.trim() },
    include: { players: true },
  });
  if (!team) {
    throw new Error(`Team "${input.teamName}" not found.`);
  }
  if (team.players.length >= MAX_ROSTER) {
    throw new Error(`**${team.name}** already has ${MAX_ROSTER} players.`);
  }

  await prisma.player.update({
    where: { id: player.id },
    data: {
      teamId: team.id,
      rosterRole: rosterRoleForTeamJoin(team.players.length),
    },
  });
  await rebalanceTeamRoster(team.id);

  return { team, player };
}

export async function adminRemovePlayerFromTeam(discordId: string) {
  const player = await requirePlayer(discordId);
  if (player.isCaptain) {
    throw new Error("Use `/captain remove` for captains.");
  }
  if (!player.teamId) {
    throw new Error(`${player.discordName} is not on a team.`);
  }

  const teamName = player.team?.name ?? "their team";
  const teamId = player.teamId;
  await prisma.player.update({
    where: { id: player.id },
    data: { teamId: null, rosterRole: null },
  });
  await rebalanceTeamRoster(teamId);

  return { name: player.steamName, teamName };
}

/** First 5 (captain first, then join order) are starters; 6–7 are subs. */
export async function rebalanceTeamRoster(teamId: string) {
  const players = await prisma.player.findMany({
    where: { teamId },
    orderBy: [{ isCaptain: "desc" }, { createdAt: "asc" }],
  });
  for (let i = 0; i < players.length; i++) {
    await prisma.player.update({
      where: { id: players[i].id },
      data: { rosterRole: i >= MIN_ROSTER ? "sub" : null },
    });
  }
}

export async function adminCreateDummyPlayers(count: number) {
  const created: string[] = [];
  const existing = await prisma.player.findMany({
    where: { discordId: { startsWith: DUMMY_PREFIX } },
    select: { steam32: true },
  });
  const usedSteam = new Set(existing.map((p) => p.steam32));
  let steam32 = 900_000_001;
  let index = existing.length + 1;

  for (let n = 0; n < count; n++) {
    while (usedSteam.has(steam32)) steam32 += 1;
    const role = STARTING_ROLES[n % STARTING_ROLES.length];
    const medal = MEDALS[n % MEDALS.length];
    const name = `Test ${role} ${index}`;
    await prisma.player.create({
      data: {
        discordId: `${DUMMY_PREFIX}${steam32}`,
        discordName: name,
        steam32,
        steamName: name,
        medal,
        rolesJson: stringifyRoles([role]),
      },
    });
    usedSteam.add(steam32);
    created.push(name);
    steam32 += 1;
    index += 1;
  }

  return { created };
}

export async function adminCreateDummyTeams(teamCount = 2, rosterSize = MIN_ROSTER) {
  const size = Math.min(MAX_ROSTER, Math.max(MIN_ROSTER, rosterSize));
  const existingCount = await prisma.team.count();
  if (existingCount + teamCount > MAX_CAPTAINS) {
    throw new Error(
      `Already have ${existingCount} teams. Dummy teams would exceed the ${MAX_CAPTAINS} team cap.`,
    );
  }

  const taken = new Set(
    (await prisma.team.findMany({ select: { name: true } })).map((t) => t.name),
  );
  const names = DUMMY_TEAM_NAMES.filter((name) => !taken.has(name)).slice(0, teamCount);
  if (names.length < teamCount) {
    throw new Error("Not enough unused dummy team names. Run `/player dummy-teams-clear` first.");
  }

  const existingSteam = await prisma.player.findMany({ select: { steam32: true } });
  const usedSteam = new Set(existingSteam.map((p) => p.steam32));
  let steam32 = 910_000_001;

  const nextSteam = () => {
    while (usedSteam.has(steam32)) steam32 += 1;
    const value = steam32;
    usedSteam.add(value);
    steam32 += 1;
    return value;
  };

  const created: { name: string; players: string[] }[] = [];

  for (const name of names) {
    const players: string[] = [];
    const captainSteam = nextSteam();
    const captain = await prisma.player.create({
      data: {
        discordId: `${DUMMY_TEAM_PREFIX}${captainSteam}`,
        discordName: `${name} Captain`,
        steam32: captainSteam,
        steamName: `${name} Captain`,
        medal: MEDALS[0],
        rolesJson: stringifyRoles(["mid"]),
        isCaptain: true,
      },
    });

    const team = await prisma.team.create({
      data: {
        name,
        captainId: captain.id,
        purse: STARTING_PURSE,
      },
    });

    await prisma.player.update({
      where: { id: captain.id },
      data: { teamId: team.id, rosterRole: null },
    });
    players.push(`${captain.steamName} (C)`);

    for (let i = 1; i < size; i++) {
      const role = STARTING_ROLES[i % STARTING_ROLES.length];
      const medal = MEDALS[i % MEDALS.length];
      const playerSteam = nextSteam();
      const playerName = `${name} ${role.replace("_", " ")}`;
      await prisma.player.create({
        data: {
          discordId: `${DUMMY_TEAM_PREFIX}${playerSteam}`,
          discordName: playerName,
          steam32: playerSteam,
          steamName: playerName,
          medal,
          rolesJson: stringifyRoles([role]),
          teamId: team.id,
          rosterRole: rosterRoleForTeamJoin(i),
        },
      });
      players.push(playerName);
    }

    await rebalanceTeamRoster(team.id);
    created.push({ name, players });
  }

  return { created };
}

export async function adminClearDummyTeams() {
  const dummyPlayers = await prisma.player.findMany({
    where: { discordId: { startsWith: DUMMY_TEAM_PREFIX } },
    select: { id: true, teamId: true },
  });
  const teamIds = [
    ...new Set(dummyPlayers.map((p) => p.teamId).filter((id): id is string => Boolean(id))),
  ];
  const playerIds = dummyPlayers.map((p) => p.id);

  if (teamIds.length > 0) {
    await prisma.scheduledFixture.deleteMany({
      where: {
        OR: [{ radiantTeamId: { in: teamIds } }, { direTeamId: { in: teamIds } }],
      },
    });
    await prisma.bid.deleteMany({ where: { teamId: { in: teamIds } } });
    await prisma.auctionLot.updateMany({
      where: { teamId: { in: teamIds } },
      data: { teamId: null },
    });
    await prisma.match.updateMany({
      where: { radiantTeamId: { in: teamIds } },
      data: { radiantTeamId: null },
    });
    await prisma.match.updateMany({
      where: { direTeamId: { in: teamIds } },
      data: { direTeamId: null },
    });
    await prisma.match.updateMany({
      where: { winnerTeamId: { in: teamIds } },
      data: { winnerTeamId: null },
    });
    await prisma.player.updateMany({
      where: { teamId: { in: teamIds } },
      data: { teamId: null, rosterRole: null, isCaptain: false },
    });
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
  }

  if (playerIds.length > 0) {
    await prisma.bid.deleteMany({ where: { playerId: { in: playerIds } } });
    await prisma.auctionLot.deleteMany({ where: { playerId: { in: playerIds } } });
    await prisma.matchPlayer.updateMany({
      where: { playerId: { in: playerIds } },
      data: { playerId: null },
    });
    await prisma.player.deleteMany({ where: { id: { in: playerIds } } });
  }

  return { teams: teamIds.length, players: playerIds.length };
}

export async function adminClearDummyPlayers() {
  const dummies = await prisma.player.findMany({
    where: { discordId: { startsWith: DUMMY_PREFIX } },
    select: { id: true, steamName: true, teamId: true, isCaptain: true },
  });
  const removable = dummies.filter((p) => !p.isCaptain && !p.teamId);
  if (removable.length === 0) {
    return { removed: 0 };
  }
  const ids = removable.map((p) => p.id);
  await prisma.bid.deleteMany({ where: { playerId: { in: ids } } });
  await prisma.auctionLot.deleteMany({ where: { playerId: { in: ids } } });
  await prisma.matchPlayer.updateMany({
    where: { playerId: { in: ids } },
    data: { playerId: null },
  });
  await prisma.player.deleteMany({ where: { id: { in: ids } } });
  return { removed: removable.length };
}

export async function adminUpdatePlayerProfile(input: {
  discordId: string;
  medal?: string | null;
  role?: string | null;
  playWindow?: string | null;
}) {
  const medalInput = input.medal?.trim() || undefined;
  const roleInput = input.role?.trim() || undefined;
  const windowInput = input.playWindow?.trim() || undefined;
  if (!medalInput && !roleInput && !windowInput) {
    throw new Error("Provide **rank**, **role**, and/or **when** to change.");
  }

  const player = await requirePlayer(input.discordId);
  const medal = medalInput ? parseMedal(medalInput) : undefined;
  const roles = roleInput ? parseRegistrationRole(roleInput) : undefined;
  const playWindow = windowInput ? parsePlayWindow(windowInput) : undefined;

  const updated = await prisma.player.update({
    where: { id: player.id },
    data: {
      ...(medal ? { medal } : {}),
      ...(roles ? { rolesJson: stringifyRoles(roles) } : {}),
      ...(playWindow ? { playWindow } : {}),
    },
  });

  return {
    player: updated,
    previousMedal: player.medal,
    previousRolesJson: player.rolesJson,
    previousPlayWindow: player.playWindow,
    teamName: player.team?.name ?? null,
  };
}

export async function adminResyncRosterRole(discordId: string) {
  const player = await requirePlayer(discordId);
  if (!player.teamId) {
    throw new Error(`${player.discordName} is not on a team.`);
  }

  await rebalanceTeamRoster(player.teamId);

  return { name: player.steamName, teamId: player.teamId };
}

export async function rebalanceAllTeamRosters() {
  const teams = await prisma.team.findMany({ select: { id: true } });
  for (const team of teams) {
    await rebalanceTeamRoster(team.id);
  }
  return { teams: teams.length };
}
