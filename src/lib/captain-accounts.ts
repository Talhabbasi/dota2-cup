import { createSeasonTeam } from "./season-roster";
import { withAuctionLock, requireAuctionInactive } from "./auction-lock";
import {
  hashAdminPassword,
  verifyAdminPassword,
} from "./admin-password";
import { prisma } from "./prisma";
import { getLiveSeason } from "./seasons";
import {
  generateCaptainPasscode,
  generateCaptainToken,
} from "./web-auction";

export type CaptainSessionInfo = {
  accountId: string;
  accountToken: string | null;
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
  return withAuctionLock(async db => {
  await requireAuctionInactive(db);
  const team = await db.team.findUnique({
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

  const existing = await db.captainAccount.findUnique({
    where: {
      seasonId_loginName: { seasonId: team.seasonId, loginName },
    },
  });
  if (existing && !existing.revokedAt) {
    throw new Error(`Login "${loginName}" already exists for this season.`);
  }

  const account = existing
    ? await db.captainAccount.update({
        where: { id: existing.id },
        data: {
          passcodeHash: hashAdminPassword(passcode),
          token,
          revokedAt: null,
          teamId: team.id,
        },
      })
    : await db.captainAccount.create({
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
    accountToken: account.token,
    loginName,
    passcode,
    token,
    teamId: team.id,
    teamName: team.name,
  };
  });
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
  await withAuctionLock(db => db.captainAccount.update({
    where: { id: accountId }, data: { revokedAt: new Date(), token: null },
  }));
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
    accountToken: account.token,
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
    accountToken: account.token,
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
  return createSeasonTeam({ ...input, purse: input.purse ?? 0 });
}

export async function adminUpdateTeamMeta(input: {
  teamId: string;
  tag?: string | null;
  logoUrl?: string | null;
  name?: string | null;
}) {
  return withAuctionLock(async db => {
    await requireAuctionInactive(db);
  const data: { tag?: string | null; logoUrl?: string | null; name?: string } = {};
  if (input.tag !== undefined) data.tag = input.tag?.trim() || null;
  if (input.logoUrl !== undefined) data.logoUrl = input.logoUrl?.trim() || null;
  if (input.name?.trim()) data.name = input.name.trim();
  return db.team.update({
    where: { id: input.teamId },
    data,
  });
  });
}

export async function adminSetPlayerAuctionMeta(input: {
  playerId: string;
  auctionStatus?: string;
  basePrice?: number | null;
}) {
  return withAuctionLock(async db => {
    await requireAuctionInactive(db);
  const data: { auctionStatus?: string; basePrice?: number | null } = {};
  if (input.auctionStatus && !["UNSOLD", "SOLD"].includes(input.auctionStatus)) throw new Error("Invalid player auction status.");
  if (input.auctionStatus) data.auctionStatus = input.auctionStatus;
  if (input.basePrice != null && (!Number.isSafeInteger(input.basePrice) || input.basePrice < 1 || input.basePrice > 2147483647)) throw new Error("Base price must be a positive whole number.");
  if (input.basePrice !== undefined) data.basePrice = input.basePrice;
  return db.player.update({
    where: { id: input.playerId },
    data,
  });
  });
}
