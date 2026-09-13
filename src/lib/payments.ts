import { prisma } from "./prisma";
import { isRosterSub } from "./roles";
import {
  entryFeePkr,
  formatEntryFee,
  formatTeamFee,
  teamFeePkr,
} from "./registration-status";

export function playerMustPay(rosterRole: string | null) {
  return !isRosterSub(rosterRole);
}

export async function findPlayerByDiscord(discordId: string) {
  return prisma.player.findFirst({
    where: {
      OR: [{ discordId }, { discordId: { startsWith: `${discordId}:` } }],
    },
    include: { team: { select: { id: true, name: true } } },
  });
}

export async function recordPlayerPayment(input: {
  discordId: string;
  discordName: string;
  amount?: number;
  verifiedBy?: string;
}) {
  const player = await findPlayerByDiscord(input.discordId);
  if (!player) {
    throw new Error(
      "You are not registered in MM Dota Cup. Ask an admin to add you with `/player register`.",
    );
  }
  if (!playerMustPay(player.rosterRole)) {
    return { player, skipped: true as const, reason: "sub" as const, alreadyPaid: false };
  }

  const amount = input.amount ?? entryFeePkr();
  const alreadyPaid = Boolean(player.paidAt);
  if (alreadyPaid) {
    return { player, skipped: false as const, reason: null, alreadyPaid: true };
  }

  const updated = await prisma.player.update({
    where: { id: player.id },
    data: {
      paidAt: new Date(),
      paymentAmount: amount,
    },
    include: { team: { select: { id: true, name: true } } },
  });
  await prisma.payment.create({
    data: {
      playerId: player.id,
      discordId: input.discordId,
      discordName: input.discordName,
      screenshotPath: input.verifiedBy
        ? `admin-verified:${input.verifiedBy}`
        : "admin-verified",
      amount,
    },
  });
  return { player: updated, skipped: false as const, reason: null, alreadyPaid: false };
}

export async function adminMarkPaid(discordId: string, verifiedBy = "slash") {
  return recordPlayerPayment({
    discordId,
    discordName: "admin-mark",
    verifiedBy,
  });
}

type PlayerPayRow = {
  id: string;
  steamName: string;
  discordName: string;
  discordId: string;
  rosterRole: string | null;
  isCaptain: boolean;
  paidAt: Date | null;
  paymentAmount: number;
  team: { id: string; name: string } | null;
};

const DUMMY_PREFIX = "test-dummy-";
const DUMMY_TEAM_PREFIX = "test-dummy-team-";

function isDummyDiscordId(discordId: string) {
  return (
    discordId.startsWith(DUMMY_PREFIX) ||
    discordId.startsWith(DUMMY_TEAM_PREFIX)
  );
}

function unpaidRequired(player: PlayerPayRow) {
  return playerMustPay(player.rosterRole) && !player.paidAt;
}

export async function listUnpaidPlayers() {
  const players = await prisma.player.findMany({
    select: {
      id: true,
      steamName: true,
      discordName: true,
      discordId: true,
      rosterRole: true,
      isCaptain: true,
      paidAt: true,
      paymentAmount: true,
      team: { select: { id: true, name: true } },
    },
    orderBy: [{ team: { name: "asc" } }, { steamName: "asc" }],
  });
  return players.filter(
    (player) => !isDummyDiscordId(player.discordId) && unpaidRequired(player),
  );
}

export type TeamPaymentRow = {
  id: string;
  name: string;
  paidPkr: number;
  requiredPkr: number;
  allowed: boolean;
  unpaid: { steamName: string; discordId: string }[];
  subs: number;
  starters: number;
};

export function summarizeTeamPayments(
  name: string,
  id: string,
  players: PlayerPayRow[],
): TeamPaymentRow {
  const starters = players.filter((p) => playerMustPay(p.rosterRole));
  const subs = players.filter((p) => !playerMustPay(p.rosterRole));
  const paidPkr = starters
    .filter((p) => p.paidAt)
    .reduce((sum, p) => sum + (p.paymentAmount || entryFeePkr()), 0);
  const requiredPkr = teamFeePkr();
  const unpaid = starters.filter((p) => !p.paidAt).map((p) => ({
    steamName: p.steamName,
    discordId: p.discordId.split(":")[0],
  }));
  return {
    id,
    name,
    paidPkr,
    requiredPkr,
    allowed: paidPkr === requiredPkr,
    unpaid,
    subs: subs.length,
    starters: starters.length,
  };
}

export async function listTeamPayments(): Promise<TeamPaymentRow[]> {
  const teams = await prisma.team.findMany({
    include: {
      players: {
        select: {
          id: true,
          steamName: true,
          discordName: true,
          discordId: true,
          rosterRole: true,
          isCaptain: true,
          paidAt: true,
          paymentAmount: true,
          team: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  return teams
    .filter((team) => team.players.some((p) => !isDummyDiscordId(p.discordId)))
    .map((team) => summarizeTeamPayments(team.name, team.id, team.players));
}

export function formatPaymentPlayerLine(player: {
  steamName: string;
  discordId: string;
  team?: { name: string } | null;
  rosterRole?: string | null;
  paidAt?: Date | null;
}) {
  const team = player.team?.name ? ` · ${player.team.name}` : " · unsigned";
  const sub = player.rosterRole && !playerMustPay(player.rosterRole) ? " · sub (free)" : "";
  const paid = player.paidAt ? " · paid" : "";
  return `• **${player.steamName}** <@${player.discordId.split(":")[0]}>${team}${sub}${paid}`;
}

export function formatTeamPaymentLine(row: TeamPaymentRow) {
  const status = row.allowed
    ? "✅ allowed"
    : row.paidPkr > row.requiredPkr
      ? "⚠️ over cap"
      : "❌ short";
  const unpaid =
    row.unpaid.length === 0
      ? "all starters paid"
      : `owe: ${row.unpaid.map((p) => p.steamName).join(", ")}`;
  return `**${row.name}** — ${row.paidPkr}/${row.requiredPkr} PKR ${status} · ${row.starters} starters, ${row.subs} subs · ${unpaid}`;
}

export function formatUnpaidList(players: PlayerPayRow[]) {
  if (players.length === 0) {
    return "Everyone who must pay has paid. Substitutes are free.";
  }
  const groups = new Map<string, PlayerPayRow[]>();
  for (const player of players) {
    const key = player.team?.name ?? "Unsigned";
    const list = groups.get(key) ?? [];
    list.push(player);
    groups.set(key, list);
  }
  const lines = [
    `**Unpaid starters** (${players.length}) — ${formatEntryFee()} each. Subs do not pay.`,
  ];
  for (const [team, list] of groups) {
    lines.push(`\n**${team}** (${list.length})`);
    for (const player of list) lines.push(formatPaymentPlayerLine(player));
  }
  return lines.join("\n");
}

export function formatTeamPaymentDetail(row: TeamPaymentRow) {
  const unpaid =
    row.unpaid.length === 0
      ? "All starters paid."
      : [
          `Unpaid starters (${row.unpaid.length}):`,
          ...row.unpaid.map(
            (p) => `• **${p.steamName}** <@${p.discordId}>`,
          ),
        ].join("\n");
  return [
    formatTeamPaymentLine(row),
    `Team is allowed only at **exactly ${formatTeamFee()}** (min and max). Subs do not count.`,
    unpaid,
  ].join("\n");
}

export async function findTeamPaymentsByName(name: string) {
  const teams = await listTeamPayments();
  const q = name.trim().toLowerCase();
  return (
    teams.find((t) => t.name.toLowerCase() === q) ??
    teams.find((t) => t.name.toLowerCase().includes(q)) ??
    null
  );
}

export function formatTeamPaymentsList(rows: TeamPaymentRow[]) {
  if (rows.length === 0) return "No teams yet.";
  const allowed = rows.filter((r) => r.allowed).length;
  const collected = rows.reduce((sum, r) => sum + r.paidPkr, 0);
  const lines = [
    `**Team fees** — min and max **${formatTeamFee()}** (5 starters × ${formatEntryFee()}). Subs free.`,
    `**Collected from teams: ${collected.toLocaleString("en-PK")} PKR** · Allowed: **${allowed}/${rows.length}**`,
    ...rows.map(formatTeamPaymentLine),
  ];
  return lines.join("\n");
}

export async function getPaymentCollection() {
  const players = await prisma.player.findMany({
    where: {
      AND: [
        { discordId: { not: { startsWith: DUMMY_PREFIX } } },
        { discordId: { not: { startsWith: DUMMY_TEAM_PREFIX } } },
      ],
    },
    select: {
      steamName: true,
      rosterRole: true,
      paidAt: true,
      paymentAmount: true,
      team: { select: { name: true } },
    },
    orderBy: [{ steamName: "asc" }],
  });

  const fee = entryFeePkr();
  const starters = players.filter((p) => playerMustPay(p.rosterRole));
  const paid = starters.filter((p) => p.paidAt);
  const unpaid = starters.filter((p) => !p.paidAt);
  const collected = paid.reduce(
    (sum, p) => sum + (p.paymentAmount || fee),
    0,
  );
  const expected = starters.length * fee;
  const owed = unpaid.length * fee;
  const teams = await listTeamPayments();
  const teamsAllowed = teams.filter((t) => t.allowed).length;

  return {
    collected,
    expected,
    owed,
    paidCount: paid.length,
    unpaidCount: unpaid.length,
    starterCount: starters.length,
    teamsAllowed,
    teamCount: teams.length,
    paid,
    unpaid,
    teams,
  };
}

export function formatPaymentCollection(
  data: Awaited<ReturnType<typeof getPaymentCollection>>,
) {
  const lines = [
    "**Money collected**",
    `**In: ${data.collected.toLocaleString("en-PK")} PKR** (${data.paidCount} paid)`,
    `Still owed: **${data.owed.toLocaleString("en-PK")} PKR** (${data.unpaidCount} unpaid)`,
    `Expected from registered starters: **${data.expected.toLocaleString("en-PK")} PKR** (${data.starterCount} × ${formatEntryFee()})`,
    `Teams at exactly ${formatTeamFee()}: **${data.teamsAllowed}/${data.teamCount}**`,
  ];

  if (data.teams.length > 0) {
    lines.push("", "**By team**", ...data.teams.map(formatTeamPaymentLine));
  }

  const unsignedPaid = data.paid.filter((p) => !p.team);
  const unsignedUnpaid = data.unpaid.filter((p) => !p.team);
  if (unsignedPaid.length + unsignedUnpaid.length > 0) {
    lines.push(
      "",
      `**Unsigned starters** — paid ${unsignedPaid.length}, unpaid ${unsignedUnpaid.length}`,
    );
  }

  return lines.join("\n");
}
