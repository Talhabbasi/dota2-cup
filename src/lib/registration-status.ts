import { cache } from "react";
import { getCupSettings } from "./cup-settings-cache";
import { publicPlayerWhere } from "./dummy";
import { rosterRules } from "./games";
import { prisma } from "./prisma";
import { CUP_NAME } from "@/lib/brand";
import { getLiveSeason } from "./seasons";

function envRegistrationOpen() {
  const value = process.env.REGISTRATION_OPEN?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export function isRegistrationOpenFromEnv() {
  return envRegistrationOpen();
}

export const isRegistrationOpen = cache(async () => {
  const row = await getCupSettings();
  if (row) return row.registrationOpen;
  return envRegistrationOpen();
});

export async function setRegistrationOpen(open: boolean) {
  const row = await prisma.cupSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", registrationOpen: open },
    update: { registrationOpen: open },
  });
  return row.registrationOpen;
}

/**
 * Public sign-up cap for a season: teamCount × roster max
 * (Dota: 5 starters + 1 sub per team).
 */
export function maxRegisteredPlayersForSeason(season: {
  teamCount: number;
  game?: string | null;
  pubgMode?: string | null;
}) {
  const teams = Math.max(0, season.teamCount);
  return teams * rosterRules(season).max;
}

/** Real (non-dummy) players enrolled in the live season. */
export async function countLiveSeasonRegistrations() {
  const live = await getLiveSeason();
  if (!live) return 0;
  return prisma.seasonPlayer.count({
    where: {
      seasonId: live.id,
      player: publicPlayerWhere,
    },
  });
}

export async function getLiveRegistrationCapacity() {
  const live = await getLiveSeason();
  if (!live) return { count: 0, max: 0, full: false, live: null };
  const max = maxRegisteredPlayersForSeason(live);
  const count = await prisma.seasonPlayer.count({
    where: {
      seasonId: live.id,
      player: publicPlayerWhere,
    },
  });
  return { count, max, full: max > 0 && count >= max, live };
}

export async function isRegistrationFull() {
  const { full } = await getLiveRegistrationCapacity();
  return full;
}

/**
 * Blocks new live-season enrollments once the public cap is hit.
 * Already-enrolled players may still update their profile.
 * Admins pass `bypassCapacity` for late adds.
 */
export async function assertCanJoinLiveSeason(opts?: {
  playerId?: string | null;
  bypassCapacity?: boolean;
}) {
  if (opts?.bypassCapacity) return;

  const { count, max, full, live } = await getLiveRegistrationCapacity();
  if (!live || max <= 0 || !full) return;

  if (opts?.playerId) {
    const existing = await prisma.seasonPlayer.findUnique({
      where: {
        seasonId_playerId: {
          seasonId: live.id,
          playerId: opts.playerId,
        },
      },
      select: { playerId: true },
    });
    if (existing) return;
  }

  throw new Error(registrationFullMessage(count, max));
}

export function registrationFullMessage(count?: number, max?: number) {
  const n = count ?? max;
  const m = max;
  const filled =
    typeof n === "number" && typeof m === "number" && m > 0
      ? `${n}/${m}`
      : null;
  return (
    (filled
      ? `Registration is full (${filled} players). `
      : "Registration is full. ") +
    "Ask an admin if you need a late add."
  );
}

export function paymentsChannelName() {
  return process.env.PAYMENTS_CHANNEL_NAME?.trim() || "payments";
}

export function adminChannelName() {
  return process.env.ADMIN_CHANNEL_NAME?.trim() || "admin";
}

export function matchesChannelName() {
  return process.env.MATCHES_CHANNEL_NAME?.trim() || "matches";
}

export function isPaymentsChannelName(name: string | null | undefined) {
  if (!name) return false;
  const n = name.toLowerCase();
  const wanted = paymentsChannelName().toLowerCase();
  return n === wanted || n === "payment" || n === "payments";
}

export function entryFeePkr() {
  const raw = process.env.PAYMENT_FEE_PKR?.trim();
  const n = raw ? Number(raw) : 1000;
  return Number.isFinite(n) && n > 0 ? n : 1000;
}

export function teamFeePkr() {
  const raw = process.env.TEAM_FEE_PKR?.trim();
  const n = raw ? Number(raw) : 5000;
  return Number.isFinite(n) && n > 0 ? n : 5000;
}

export function formatTeamFee() {
  return `Rs ${teamFeePkr().toLocaleString("en-PK")} PKR`;
}

export function formatEntryFee() {
  return `Rs ${entryFeePkr().toLocaleString("en-PK")} PKR`;
}

export function paymentAccountNumber() {
  return process.env.PAYMENT_ACCOUNT_NUMBER?.trim() || "0301-3396885";
}

export function paymentAccountName() {
  return process.env.PAYMENT_ACCOUNT_NAME?.trim() || "Talha Abbasi";
}

export function paymentBankName() {
  return process.env.PAYMENT_BANK_NAME?.trim() || "SadaPay";
}

export function paymentIban() {
  return process.env.PAYMENT_IBAN?.trim() || "PK16SADA0000003013396885";
}

export function registrationClosedPublicMessage() {
  const channel = paymentsChannelName();
  return [
    `Registration for **${CUP_NAME}** is **closed**.`,
    "This is an **indoor tournament** for players who have played with **MM**. Outdoor / outside members are not allowed.",
    `Pay **${formatEntryFee()} per person**, then send your screenshot in **#${channel}**. An Admin clicks ✅ to confirm — you are not paid until then.`,
    "Already registered? You are in. Need a late add or a player removed? Ask an admin.",
  ].join("\n");
}

export function registrationClosedDiscordReply() {
  return [
    registrationClosedPublicMessage(),
    "",
    "Admins: `/player register` to add someone, `/player delete` to remove a player (`/captain remove` first if they are a captain).",
  ].join("\n");
}
