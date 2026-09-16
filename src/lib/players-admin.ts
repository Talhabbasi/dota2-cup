import {
  MAX_CAPTAINS,
  MAX_ROSTER,
  MEDAL_LABELS,
  MEDALS,
  MIN_ROSTER,
  STARTING_PURSE,
  STARTING_ROLES,
  parseMedal,
  type Medal,
} from "./constants";
import { formatRoles } from "./data";
import { playerMustPay } from "./payments";
import { parsePlayWindow } from "./play-window";
import { prisma } from "./prisma";
import {
  parseRegistrationRole,
  parseRolesJson,
  rosterRoleForTeamJoin,
  sortTeamRoster,
  starterCountOnTeam,
  stringifyRoles,
} from "./roles";
import { currentSeasonId, syncSeasonPlayer, syncSeasonPlayers } from "./seasons";

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
    throw new Error(
      "That player is a captain. Use `/captain change` to appoint someone else, or `/captain remove` to dissolve the team.",
    );
  }

  const teamName = player.team?.name;
  if (player.teamId) {
    const teamId = player.teamId;
    await prisma.player.update({
      where: { id: player.id },
      data: { teamId: null, rosterRole: null, teamJoinedAt: null },
    });
    await rebalanceTeamRoster(teamId);
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

  return { name: player.steamName, teamName: teamName ?? null };
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
      teamJoinedAt: new Date(),
      rosterRole: rosterRoleForTeamJoin(starterCountOnTeam(team.players)),
    },
  });
  await rebalanceTeamRoster(team.id);
  await syncSeasonPlayer(player.id);

  return { team, player };
}

export async function adminRemovePlayerFromTeam(discordId: string) {
  const player = await requirePlayer(discordId);
  if (player.isCaptain) {
    throw new Error(
      "That player is a captain. Use `/captain change` first if you want to keep the team, or `/captain remove` to dissolve it.",
    );
  }
  if (!player.teamId) {
    throw new Error(`${player.discordName} is not on a team.`);
  }

  const teamName = player.team?.name ?? "their team";
  const teamId = player.teamId;
  await prisma.player.update({
    where: { id: player.id },
    data: { teamId: null, rosterRole: null, teamJoinedAt: null },
  });
  await rebalanceTeamRoster(teamId);
  await syncSeasonPlayer(player.id);

  return { name: player.steamName, teamName };
}

/** Captain, then join order: first 5 are starters; 6–7 are subs. */
export async function rebalanceTeamRoster(teamId: string) {
  const players = await prisma.player.findMany({
    where: { teamId },
    include: {
      lots: {
        where: { status: "sold", teamId },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  const missingJoin = players.filter((player) => !player.teamJoinedAt);
  for (const player of missingJoin) {
    await prisma.player.update({
      where: { id: player.id },
      data: {
        teamJoinedAt: player.lots[0]?.createdAt ?? player.createdAt,
      },
    });
  }

  const ordered = sortTeamRoster(
    missingJoin.length === 0
      ? players
      : await prisma.player.findMany({ where: { teamId } }),
  );
  for (let i = 0; i < ordered.length; i++) {
    const nextRole = i >= MIN_ROSTER ? "sub" : null;
    if (ordered[i].rosterRole === nextRole) continue;
    await prisma.player.update({
      where: { id: ordered[i].id },
      data: { rosterRole: nextRole },
    });
  }
  await syncSeasonPlayers(ordered.map((player) => player.id));
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
    const dummy = await prisma.player.create({
      data: {
        discordId: `${DUMMY_PREFIX}${steam32}`,
        discordName: name,
        steam32,
        steamName: name,
        medal,
        rolesJson: stringifyRoles([role]),
      },
    });
    await syncSeasonPlayer(dummy.id);
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
        seasonId: await currentSeasonId(),
        captainId: captain.id,
        purse: STARTING_PURSE,
      },
    });

    await prisma.player.update({
      where: { id: captain.id },
      data: { teamId: team.id, rosterRole: null, teamJoinedAt: new Date() },
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
          teamJoinedAt: new Date(),
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
      data: { teamId: null, rosterRole: null, isCaptain: false, teamJoinedAt: null },
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
  await syncSeasonPlayer(updated.id);

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

export async function listRegisteredPlayers() {
  return prisma.player.findMany({
    where: {
      AND: [
        { discordId: { not: { startsWith: DUMMY_PREFIX } } },
        { discordId: { not: { startsWith: DUMMY_TEAM_PREFIX } } },
      ],
    },
    orderBy: [{ steamName: "asc" }],
    include: { team: { select: { name: true } } },
  });
}

export function formatPlayerDirectory(
  players: Awaited<ReturnType<typeof listRegisteredPlayers>>,
) {
  if (players.length === 0) return "No players registered.";

  const groups = new Map<string, string[]>();
  for (const player of players) {
    const team = player.team?.name ?? "Unsigned";
    const mention = `<@${player.discordId.split(":")[0]}>`;
    const roles = formatRoles(parseRolesJson(player.rolesJson));
    const medal =
      MEDAL_LABELS[player.medal as Medal] ?? player.medal;
    const slot = player.isCaptain
      ? "captain"
      : player.rosterRole === "sub"
        ? "sub"
        : player.teamId
          ? "starter"
          : "unsigned";
    let fee = "unpaid";
    if (!playerMustPay(player.rosterRole)) fee = "sub · free";
    else if (player.paidAt) fee = "paid";
    const line = `• **${player.steamName}** ${mention} · ${medal} · ${roles} · ${slot} · ${fee}`;
    const list = groups.get(team) ?? [];
    list.push(line);
    groups.set(team, list);
  }

  const teamNames = [...groups.keys()].sort((a, b) => {
    if (a === "Unsigned") return 1;
    if (b === "Unsigned") return -1;
    return a.localeCompare(b);
  });

  const lines = [`**Players** (${players.length})`, ""];
  for (const name of teamNames) {
    lines.push(`**${name}**`);
    lines.push(...(groups.get(name) ?? []));
    lines.push("");
  }
  return lines.join("\n").trim();
}

export async function listUnsignedPlayers() {
  const players = await listRegisteredPlayers();
  return players.filter((player) => !player.teamId && !player.isCaptain);
}

export function formatUnsignedPlayers(
  players: Awaited<ReturnType<typeof listUnsignedPlayers>>,
) {
  if (players.length === 0) {
    return "No unsigned players. Everyone registered is on a team.";
  }

  const groups = new Map<string, typeof players>();
  for (const player of players) {
    const medal = player.medal.toLowerCase();
    const list = groups.get(medal) ?? [];
    list.push(player);
    groups.set(medal, list);
  }

  const lines = [
    `**Unsigned players** (${players.length}) — not on a team, still in the auction pool`,
    "",
  ];
  for (const medal of MEDALS) {
    const list = groups.get(medal);
    if (!list || list.length === 0) continue;
    lines.push(`**${MEDAL_LABELS[medal]}** (${list.length})`);
    for (const player of list) {
      const mention = `<@${player.discordId.split(":")[0]}>`;
      const roles = formatRoles(parseRolesJson(player.rolesJson));
      lines.push(`• **${player.steamName}** ${mention} · ${roles}`);
    }
    lines.push("");
  }
  const leftover = [...groups.keys()].filter(
    (medal) => !(MEDALS as readonly string[]).includes(medal),
  );
  for (const medal of leftover) {
    const list = groups.get(medal) ?? [];
    lines.push(`**${medal}** (${list.length})`);
    for (const player of list) {
      const mention = `<@${player.discordId.split(":")[0]}>`;
      const roles = formatRoles(parseRolesJson(player.rolesJson));
      lines.push(`• **${player.steamName}** ${mention} · ${roles}`);
    }
  }
  return lines.join("\n").trim();
}
