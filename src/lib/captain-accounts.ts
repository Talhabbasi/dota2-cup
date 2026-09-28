import {
  hashAdminPassword,
  verifyAdminPassword,
} from "./admin-password";
import { prisma } from "./prisma";
import { currentSeasonId, getLiveSeason } from "./seasons";
import {
  generateCaptainPasscode,
  generateCaptainToken,
} from "./web-auction";

export type CaptainSessionInfo = {
  accountId: string;
  teamId: string;
  teamName: string;
  seasonId: string;
  loginName: string;
  purse: number;
};

export async function createCaptainAccount(input: {
  teamId: string;
  loginName?: string;
  passcode?: string;
}) {
  const team = await prisma.team.findUnique({
    where: { id: input.teamId },
    select: { id: true, name: true, seasonId: true, tag: true },
  });
  if (!team?.seasonId) throw new Error("Team has no season.");

  const loginName =
    input.loginName?.trim().toLowerCase() ||
    (team.tag?.trim().toLowerCase() ||
      team.name.replace(/^Team\s+/i, "").trim().toLowerCase().replace(/\s+/g, "-"));
  if (!loginName) throw new Error("Login name required.");

  const passcode = input.passcode?.trim() || generateCaptainPasscode();
  const token = generateCaptainToken();

  const existing = await prisma.captainAccount.findUnique({
    where: {
      seasonId_loginName: { seasonId: team.seasonId, loginName },
    },
  });
  if (existing && !existing.revokedAt) {
    throw new Error(`Login "${loginName}" already exists for this season.`);
  }

  const account = existing
    ? await prisma.captainAccount.update({
        where: { id: existing.id },
        data: {
          passcodeHash: hashAdminPassword(passcode),
          token,
          revokedAt: null,
          teamId: team.id,
        },
      })
    : await prisma.captainAccount.create({
        data: {
          seasonId: team.seasonId,
          teamId: team.id,
          loginName,
          passcodeHash: hashAdminPassword(passcode),
          token,
        },
      });

  return {
    accountId: account.id,
    loginName,
    passcode,
    token,
    teamId: team.id,
    teamName: team.name,
  };
}

export async function listCaptainAccounts(seasonId?: string) {
  const sid = seasonId ?? (await getLiveSeason())?.id;
  if (!sid) return [];
  return prisma.captainAccount.findMany({
    where: { seasonId: sid, revokedAt: null },
    include: { team: { select: { id: true, name: true, purse: true, tag: true } } },
    orderBy: { loginName: "asc" },
  });
}

export async function revokeCaptainAccount(accountId: string) {
  await prisma.captainAccount.update({
    where: { id: accountId },
    data: { revokedAt: new Date(), token: null },
  });
}

export async function verifyCaptainLogin(input: {
  loginName: string;
  passcode: string;
}): Promise<CaptainSessionInfo | null> {
  const season = await getLiveSeason();
  if (!season) return null;
  const loginName = input.loginName.trim().toLowerCase();
  const account = await prisma.captainAccount.findUnique({
    where: {
      seasonId_loginName: { seasonId: season.id, loginName },
    },
    include: { team: { select: { id: true, name: true, purse: true } } },
  });
  if (!account || account.revokedAt) return null;
  if (!verifyAdminPassword(input.passcode, account.passcodeHash)) return null;
  return {
    accountId: account.id,
    teamId: account.teamId,
    teamName: account.team.name,
    seasonId: account.seasonId,
    loginName: account.loginName,
    purse: account.team.purse,
  };
}

export async function verifyCaptainToken(
  token: string,
): Promise<CaptainSessionInfo | null> {
  const account = await prisma.captainAccount.findUnique({
    where: { token: token.trim() },
    include: { team: { select: { id: true, name: true, purse: true } } },
  });
  if (!account || account.revokedAt) return null;
  const live = await getLiveSeason();
  if (!live || live.id !== account.seasonId) return null;
  return {
    accountId: account.id,
    teamId: account.teamId,
    teamName: account.team.name,
    seasonId: account.seasonId,
    loginName: account.loginName,
    purse: account.team.purse,
  };
}

export async function adminCreateManualTeam(input: {
  name: string;
  tag?: string | null;
  logoUrl?: string | null;
  captainDiscordId?: string | null;
  captainPlayerId?: string | null;
  purse?: number;
}) {
  const seasonId = await currentSeasonId();
  const name = input.name.trim();
  if (!name) throw new Error("Team name is required.");

  const taken = await prisma.team.findFirst({
    where: { seasonId, name: { equals: name, mode: "insensitive" } },
  });
  if (taken) throw new Error(`Team "${name}" already exists.`);

  let captainId = input.captainPlayerId?.trim() || null;
  if (!captainId && input.captainDiscordId?.trim()) {
    const player = await prisma.player.findFirst({
      where: {
        OR: [
          { discordId: input.captainDiscordId.trim() },
          { discordId: { startsWith: `${input.captainDiscordId.trim()}:` } },
        ],
      },
    });
    if (!player) throw new Error("Captain player not found.");
    captainId = player.id;
  }
  if (!captainId) throw new Error("Pick a captain player.");

  const team = await prisma.team.create({
    data: {
      name,
      tag: input.tag?.trim() || null,
      logoUrl: input.logoUrl?.trim() || null,
      seasonId,
      captainId,
      purse: input.purse ?? 0,
    },
  });

  await prisma.player.update({
    where: { id: captainId },
    data: {
      teamId: team.id,
      isCaptain: true,
      teamJoinedAt: new Date(),
      auctionStatus: "SOLD",
    },
  });

  return team;
}

export async function adminUpdateTeamMeta(input: {
  teamId: string;
  tag?: string | null;
  logoUrl?: string | null;
  name?: string | null;
}) {
  const data: { tag?: string | null; logoUrl?: string | null; name?: string } = {};
  if (input.tag !== undefined) data.tag = input.tag?.trim() || null;
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl?.trim() || null;
  if (input.name?.trim()) data.name = input.name.trim();
  return prisma.team.update({
    where: { id: input.teamId },
    data,
  });
}

export async function adminSetPlayerAuctionMeta(input: {
  playerId: string;
  auctionStatus?: string;
  basePrice?: number | null;
}) {
  const data: { auctionStatus?: string; basePrice?: number | null } = {};
  if (input.auctionStatus) data.auctionStatus = input.auctionStatus;
  if (input.basePrice !== undefined) data.basePrice = input.basePrice;
  return prisma.player.update({
    where: { id: input.playerId },
    data,
  });
}
