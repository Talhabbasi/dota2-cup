import {
  MAX_CAPTAINS,
  MAX_ROSTER,
  STARTING_PURSE,
} from "./constants";
import { prisma } from "./prisma";
import { parseRolesJson } from "./roles";
import { formatRoles } from "./data";

async function requirePlayer(discordId: string) {
  const player = await prisma.player.findUnique({
    where: { discordId },
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
  const taken = await prisma.team.findUnique({ where: { name } });
  if (taken) throw new Error(`Team "${name}" already exists.`);

  const team = await prisma.team.create({
    data: {
      name,
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
    },
  });

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
  return { teamName: name };
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
      return `${roles}${sub} — ${p.steamName} / ${p.discordName}${tag}`;
    })
    .join("\n");
}
