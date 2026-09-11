import { prisma } from "./prisma";

function envRegistrationOpen() {
  const value = process.env.REGISTRATION_OPEN?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export async function isRegistrationOpen() {
  try {
    const row = await prisma.cupSettings.findUnique({
      where: { id: "singleton" },
    });
    if (row) return row.registrationOpen;
  } catch {
    /* table not pushed yet */
  }
  return envRegistrationOpen();
}

export async function setRegistrationOpen(open: boolean) {
  const row = await prisma.cupSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", registrationOpen: open },
    update: { registrationOpen: open },
  });
  return row.registrationOpen;
}

export function paymentsChannelName() {
  return process.env.PAYMENTS_CHANNEL_NAME?.trim() || "payments";
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

export function registrationClosedPublicMessage() {
  const channel = paymentsChannelName();
  return [
    "Registration for **MM Dota Cup** is **closed**.",
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
