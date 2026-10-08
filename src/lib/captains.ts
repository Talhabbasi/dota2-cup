import { withAuctionLock, requireAuctionInactive, type AuctionDb } from "./auction-lock";
import { createSeasonTeam, syncPlayerRosterToSeason } from "./season-roster";
import {
  MAX_ROSTER,
  STARTING_PURSE,
} from "./constants";
import { formatRoles } from "./data";
import { PLAY_WINDOW_SHORT, playWindowOrBoth } from "./play-window";
import { rebalanceTeamRoster } from "./players-admin";
import { prisma } from "./prisma";
import { liveRoster } from "./live-roster";
import { currentSeasonFilter } from "./seasons";
import { parseRolesJson } from "./roles";

async function requirePlayer(discordId: string, db: AuctionDb = prisma) {
  const player = await db.player.findFirst({
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
  return createSeasonTeam({ name: input.teamName, captainDiscordId: input.discordId, purse: STARTING_PURSE });
}

export async function adminRemoveCaptain(discordId: string) {
 return withAuctionLock(async db => {
 await requireAuctionInactive(db);
  const player = await requirePlayer(discordId, db);
  if (!player.isCaptain || !player.teamId) {
    throw new Error(`${player.discordName} is not a captain.`);
  }

  const teamId = player.teamId;
  const roster = await db.player.findMany({
    where: { teamId },
    select: { id: true, discordId: true },
  });
  const rosterIds = roster.map((row) => row.id);
  await db.bid.deleteMany({ where: { teamId } });
  await db.auctionLot.updateMany({
    where: { teamId },
    data: { teamId: null },
  });

  await db.player.updateMany({
    where: { teamId },
    data: {
      teamId: null,
      rosterRole: null,
      isCaptain: false,
      teamJoinedAt: null,
    },
  });

  await db.match.updateMany({
    where: { radiantTeamId: teamId },
    data: { radiantTeamId: null },
  });
  await db.match.updateMany({
    where: { direTeamId: teamId },
    data: { direTeamId: null },
  });
  await db.match.updateMany({
    where: { winnerTeamId: teamId },
    data: { winnerTeamId: null },
  });

  const name = player.team?.name ?? "the team";
  await db.team.delete({ where: { id: teamId } });
  for (const id of rosterIds) await syncPlayerRosterToSeason(id, db);
  return {
    teamName: name,
    rosterDiscordIds: roster.map((row) => row.discordId),
  };

 });
}

async function findTeamByName(name: string, db: AuctionDb = prisma) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Team name cannot be empty.");
  const team = await db.team.findFirst({
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
 return withAuctionLock(async db => {
 await requireAuctionInactive(db);
  const team = await findTeamByName(input.teamName, db);
  const next = await requirePlayer(input.discordId, db);

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
  const roster = await liveRoster();
  if (joining && team.players.length >= roster.max) {
    throw new Error(
      `**${team.name}** already has ${roster.max} players. Remove someone, then change captain.`,
    );
  }

  const previous =
    team.players.find((player) => player.id === team.captainId) ??
    team.players.find((player) => player.isCaptain) ??
    null;

  await (async (tx: AuctionDb) => {
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
  })(db);
  await db.captainAccount.updateMany({ where: { teamId: team.id, revokedAt: null }, data: { revokedAt: new Date(), token: null } });

  await rebalanceTeamRoster(team.id, db);


  const updated = await db.team.findUniqueOrThrow({
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

 });
}

/**
 * Rename a franchise only. Match and fixture rows keep the same team ids,
 * times, and opponents — website/Discord just show the new name.
 */
export async function adminRenameTeam(input: {
  teamName: string;
  newName: string;
}) {
 return withAuctionLock(async db => {
 await requireAuctionInactive(db);
  const team = await findTeamByName(input.teamName, db);
  const newName = input.newName.trim();
  if (!newName) throw new Error("New team name cannot be empty.");
  if (newName.length > 80) {
    throw new Error("Team name is too long (80 characters max).");
  }
  if (team.name.toLowerCase() === newName.toLowerCase()) {
    throw new Error(`That team is already named **${team.name}**.`);
  }

  const taken = await db.team.findFirst({
    where: {
      seasonId: team.seasonId,
      name: { equals: newName, mode: "insensitive" },
      NOT: { id: team.id },
    },
  });
  if (taken) throw new Error(`Team **${taken.name}** already exists this season.`);

  await db.team.update({
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
