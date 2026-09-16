import {
  MAX_CAPTAINS,
  MAX_ROSTER,
  STARTING_PURSE,
} from "./constants";
import { formatRoles } from "./data";
import { PLAY_WINDOW_SHORT, playWindowOrBoth } from "./play-window";
import { rebalanceTeamRoster } from "./players-admin";
import { prisma } from "./prisma";
import { currentSeasonId, currentSeasonFilter, syncSeasonPlayer, syncSeasonPlayers } from "./seasons";
import { parseRolesJson } from "./roles";

async function requirePlayer(discordId: string) {
  const player = await prisma.player.findFirst({
    where: {
      OR: [{ discordId }, { discordId: { startsWith: `${discordId}:` } }],
    },
    include: { team: true },
  });
  if (!player) {
    throw new Error("That user must /register first (Steam + medal + role).");
  }
  return player;
}

export async function adminAddCaptain(input: {
  discordId: string;
  teamName: string;
}) {
  const player = await requirePlayer(input.discordId);
  if (player.teamId || player.isCaptain) {
    throw new Error(`${player.discordName} is already on a team.`);
  }

  const teamCount = await prisma.team.count();
  if (teamCount >= MAX_CAPTAINS) {
    throw new Error(`Already at ${MAX_CAPTAINS} teams.`);
  }

  const name = input.teamName.trim();
  const taken = await prisma.team.findUnique({
    where: { name },
  });
  if (taken && taken.seasonId && taken.seasonId !== (await currentSeasonId())) {
    throw new Error(`Team "${name}" exists in another season.`);
  }
  if (taken) throw new Error(`Team "${name}" already exists.`);

  const team = await prisma.team.create({
    data: {
      name,
      seasonId: await currentSeasonId(),
      captainId: player.id,
      purse: STARTING_PURSE,
    },
  });

  await prisma.player.update({
    where: { id: player.id },
    data: {
      teamId: team.id,
      isCaptain: true,
      rosterRole: null,
      teamJoinedAt: new Date(),
    },
  });
  await syncSeasonPlayer(player.id);

  return prisma.team.findUniqueOrThrow({
    where: { id: team.id },
    include: { players: true },
  });
}

export async function adminRemoveCaptain(discordId: string) {
  const player = await requirePlayer(discordId);
  if (!player.isCaptain || !player.teamId) {
    throw new Error(`${player.discordName} is not a captain.`);
  }

  const teamId = player.teamId;
  const rosterIds = (
    await prisma.player.findMany({
      where: { teamId },
      select: { id: true },
    })
  ).map((row) => row.id);
  const state = await ensureAuctionState();
  if (
    state.status === "running" &&
    state.currentBidderTeamId === teamId
  ) {
    await prisma.auctionState.update({
      where: { id: "singleton" },
      data: { currentBidderTeamId: null },
    });
  }

  await prisma.bid.deleteMany({ where: { teamId } });
  await prisma.auctionLot.updateMany({
    where: { teamId },
    data: { teamId: null },
  });

  await prisma.player.updateMany({
    where: { teamId },
    data: {
      teamId: null,
      rosterRole: null,
      isCaptain: false,
      teamJoinedAt: null,
    },
  });

  await prisma.match.updateMany({
    where: { radiantTeamId: teamId },
    data: { radiantTeamId: null },
  });
  await prisma.match.updateMany({
    where: { direTeamId: teamId },
    data: { direTeamId: null },
  });
  await prisma.match.updateMany({
    where: { winnerTeamId: teamId },
    data: { winnerTeamId: null },
  });

  const name = player.team?.name ?? "the team";
  await prisma.team.delete({ where: { id: teamId } });
  await syncSeasonPlayers(rosterIds);
  return { teamName: name };
}

async function findTeamByName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Team name cannot be empty.");
  const team = await prisma.team.findFirst({
    where: {
      name: { equals: trimmed, mode: "insensitive" },
      ...(await currentSeasonFilter()),
    },
    include: { players: true },
  });
  if (!team) throw new Error(`No team named "${trimmed}".`);
  return team;
}

export async function listTeamNames() {
  return prisma.team.findMany({
    where: await currentSeasonFilter(),
    select: { name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Swap who captains a franchise. Roster, purse, group, and scheduled
 * matches stay on the same team id — only captainId / isCaptain change.
 * The previous captain stays on the roster as a regular player.
 */
export async function adminChangeCaptain(input: {
  teamName: string;
  discordId: string;
}) {
  const team = await findTeamByName(input.teamName);
  const next = await requirePlayer(input.discordId);

  if (next.isCaptain && next.teamId === team.id) {
    throw new Error(`${next.discordName} is already captain of **${team.name}**.`);
  }
  if (next.isCaptain) {
    throw new Error(
      `${next.discordName} already captains **${next.team?.name ?? "another team"}**. Change that team first.`,
    );
  }
  if (next.teamId && next.teamId !== team.id) {
    throw new Error(
      `${next.discordName} is already on **${next.team?.name}**. Use \`/player remove\` first.`,
    );
  }

  const joining = next.teamId !== team.id;
  if (joining && team.players.length >= MAX_ROSTER) {
    throw new Error(
      `**${team.name}** already has ${MAX_ROSTER} players. Remove someone, then change captain.`,
    );
  }

  const previous =
    team.players.find((player) => player.id === team.captainId) ??
    team.players.find((player) => player.isCaptain) ??
    null;

  await prisma.$transaction(async (tx) => {
    await tx.player.updateMany({
      where: { teamId: team.id, isCaptain: true },
      data: { isCaptain: false },
    });
    await tx.player.update({
      where: { id: next.id },
      data: {
        teamId: team.id,
        isCaptain: true,
        teamJoinedAt: joining ? new Date() : next.teamJoinedAt,
      },
    });
    await tx.team.update({
      where: { id: team.id },
      data: { captainId: next.id },
    });
  });

  await rebalanceTeamRoster(team.id);
  await syncSeasonPlayers(
    [next.id, previous?.id].filter((id): id is string => Boolean(id)),
  );

  const updated = await prisma.team.findUniqueOrThrow({
    where: { id: team.id },
    include: { players: true },
  });

  return {
    team: updated,
    joinedRoster: joining,
    previousCaptain: previous
      ? {
          discordId: previous.discordId,
          discordName: previous.discordName,
          steamName: previous.steamName,
        }
      : null,
    nextCaptain: {
      discordId: next.discordId,
      discordName: next.discordName,
      steamName: next.steamName,
      playWindow: next.playWindow,
    },
  };
}

/**
 * Rename a franchise only. Match and fixture rows keep the same team ids,
 * times, and opponents — website/Discord just show the new name.
 */
export async function adminRenameTeam(input: {
  teamName: string;
  newName: string;
}) {
  const team = await findTeamByName(input.teamName);
  const newName = input.newName.trim();
  if (!newName) throw new Error("New team name cannot be empty.");
  if (newName.length > 80) {
    throw new Error("Team name is too long (80 characters max).");
  }
  if (team.name.toLowerCase() === newName.toLowerCase()) {
    throw new Error(`That team is already named **${team.name}**.`);
  }

  const taken = await prisma.team.findFirst({
    where: {
      name: { equals: newName, mode: "insensitive" },
      NOT: { id: team.id },
    },
  });
  if (taken) throw new Error(`Team **${taken.name}** already exists.`);

  await prisma.team.update({
    where: { id: team.id },
    data: { name: newName },
  });

  const captain =
    team.players.find((player) => player.id === team.captainId) ??
    team.players.find((player) => player.isCaptain) ??
    null;

  return {
    id: team.id,
    oldName: team.name,
    newName,
    captainName: captain?.steamName ?? null,
  };
}

async function ensureAuctionState() {
  return prisma.auctionState.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

export async function getTeamByCaptainDiscord(discordId: string) {
  const player = await prisma.player.findUnique({
    where: { discordId },
    include: { team: { include: { players: true } } },
  });
  if (!player?.isCaptain || !player.team) {
    throw new Error("Only a captain can do that.");
  }
  return { player, team: player.team };
}

export function rosterSummary(
  players: {
    rosterRole: string | null;
    rolesJson: string;
    steamName: string;
    isCaptain: boolean;
    discordName: string;
    playWindow?: string | null;
  }[],
) {
  if (players.length > MAX_ROSTER) {
    /* displayed only */
  }
  return players
    .map((p) => {
      const tag = p.isCaptain ? " (C)" : "";
      const sub = p.rosterRole === "sub" ? " · Sub" : "";
      const roles = formatRoles(parseRolesJson(p.rolesJson));
      const window = PLAY_WINDOW_SHORT[playWindowOrBoth(p.playWindow)];
      return `${roles}${sub} — ${p.steamName} / ${p.discordName}${tag} · ${window}`;
    })
    .join("\n");
}
