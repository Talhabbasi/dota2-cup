import { MAX_ROSTER, MIN_ROSTER } from "./constants";
import { prisma } from "./prisma";
import { rosterRoleForTeamJoin } from "./roles";

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
      rosterRole: rosterRoleForTeamJoin(team.players),
    },
  });

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
  await prisma.player.update({
    where: { id: player.id },
    data: { teamId: null, rosterRole: null },
  });

  return { name: player.steamName, teamName };
}

/** Re-number starters (first 5) vs subs (6–7) after manual changes. */
async function rebalanceTeamRoster(teamId: string) {
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

export async function adminResyncRosterRole(discordId: string) {
  const player = await requirePlayer(discordId);
  if (!player.teamId) {
    throw new Error(`${player.discordName} is not on a team.`);
  }

  await rebalanceTeamRoster(player.teamId);

  return { name: player.steamName, teamId: player.teamId };
}
