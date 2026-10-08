import { prisma } from "./prisma";
import { isRosterSub } from "./roles";
import {
  getLiveSeason,
  requireCurrentSeason,
  syncSeasonPlayer,
} from "./seasons";
import {
  entryFeePkr,
  formatEntryFee,
  teamFeePkr,
} from "./registration-status";
import { CUP_NAME } from "@/lib/brand";
import { liveRoster } from "./live-roster";
import { rosterRules } from "./games";

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

/** Mirror SeasonPlayer payment fields onto the global Player row for the active season. */
async function mirrorSeasonPaymentToPlayer(
  playerId: string,
  paidAt: Date | null,
  paymentAmount: number,
) {
  return prisma.player.update({
    where: { id: playerId },
    data: { paidAt, paymentAmount },
    include: { team: { select: { id: true, name: true } } },
  });
}

/**
 * After switching the active season, copy that season's payment state onto Player rows
 * so legacy reads of Player.paidAt match the active cup.
 */
export async function hydratePlayerPaymentsFromSeason(seasonId: string) {
  const rows = await prisma.seasonPlayer.findMany({
    where: { seasonId },
    select: { playerId: true, paidAt: true, paymentAmount: true },
  });
  const paidIds = new Set(rows.map((r) => r.playerId));

  await prisma.$transaction([
    ...rows.map((row) =>
      prisma.player.update({
        where: { id: row.playerId },
        data: {
          paidAt: row.paidAt,
          paymentAmount: row.paymentAmount,
        },
      }),
    ),
    prisma.player.updateMany({
      where: {
        id: { notIn: [...paidIds] },
        paidAt: { not: null },
      },
      data: { paidAt: null, paymentAmount: 0 },
    }),
  ]);
}

export async function recordPlayerPayment(input: {
  discordId: string;
  discordName: string;
  amount?: number;
  verifiedBy?: string;
}) {
  const season = await requireCurrentSeason();
  const player = await findPlayerByDiscord(input.discordId);
  if (!player) {
    throw new Error(
      `You are not registered in ${CUP_NAME}. Ask an admin to add you with /player register.`,
    );
  }

  const membership = await syncSeasonPlayer(player.id);
  const rosterRole = membership?.rosterRole ?? player.rosterRole;
  if (!playerMustPay(rosterRole)) {
    return { player, skipped: true as const, reason: "sub" as const, alreadyPaid: false };
  }

  const amount = input.amount ?? entryFeePkr();
  const alreadyPaid = Boolean(membership?.paidAt ?? player.paidAt);
  if (alreadyPaid) {
    return { player, skipped: false as const, reason: null, alreadyPaid: true };
  }

  const now = new Date();
  await prisma.seasonPlayer.upsert({
    where: {
      seasonId_playerId: { seasonId: season.id, playerId: player.id },
    },
    create: {
      seasonId: season.id,
      playerId: player.id,
      teamId: player.teamId,
      rosterRole: player.rosterRole,
      teamJoinedAt: player.teamJoinedAt,
      isCaptain: player.isCaptain,
      medal: player.medal,
      rolesJson: player.rolesJson,
      playWindow: player.playWindow,
      paidAt: now,
      paymentAmount: amount,
    },
    update: {
      paidAt: now,
      paymentAmount: amount,
    },
  });

  const updated = await mirrorSeasonPaymentToPlayer(player.id, now, amount);

  await prisma.payment.create({
    data: {
      seasonId: season.id,
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

async function assertLivePaymentSeason(seasonId?: string | null) {
  const live = await requireCurrentSeason();
  const requested = seasonId?.trim();
  if (requested && requested !== live.id) {
    throw new Error("Payments can only be changed on the active season.");
  }
  return live;
}

export async function adminMarkPaid(
  discordId: string,
  verifiedBy = "slash",
  seasonId?: string | null,
) {
  await assertLivePaymentSeason(seasonId);
  return recordPlayerPayment({
    discordId,
    discordName: "admin-mark",
    verifiedBy,
  });
}

export async function adminClearPaid(
  discordId: string,
  seasonId?: string | null,
) {
  const season = await assertLivePaymentSeason(seasonId);
  const player = await findPlayerByDiscord(discordId);
  if (!player) throw new Error("Player not found.");

  const membership = await prisma.seasonPlayer.findUnique({
    where: {
      seasonId_playerId: { seasonId: season.id, playerId: player.id },
    },
  });
  const wasPaid = Boolean(membership?.paidAt ?? player.paidAt);
  if (!wasPaid) {
    return { player, cleared: false as const };
  }

  await prisma.seasonPlayer.upsert({
    where: {
      seasonId_playerId: { seasonId: season.id, playerId: player.id },
    },
    create: {
      seasonId: season.id,
      playerId: player.id,
      teamId: player.teamId,
      rosterRole: player.rosterRole,
      teamJoinedAt: player.teamJoinedAt,
      isCaptain: player.isCaptain,
      medal: player.medal,
      rolesJson: player.rolesJson,
      playWindow: player.playWindow,
      paidAt: null,
      paymentAmount: 0,
    },
    update: {
      paidAt: null,
      paymentAmount: 0,
    },
  });

  const updated = await mirrorSeasonPaymentToPlayer(player.id, null, 0);
  return { player: updated, cleared: true as const };
}

export type AdminPaymentPlayerRow = {
  id: string;
  discordId: string;
  steamName: string;
  teamName: string | null;
  rosterRole: string | null;
  isCaptain: boolean;
  mustPay: boolean;
  paid: boolean;
  amount: number;
  paidAtLabel: string | null;
};

async function seasonForPayments(seasonId?: string | null) {
  if (seasonId?.trim()) {
    return prisma.season.findUnique({ where: { id: seasonId.trim() } });
  }
  return getLiveSeason();
}

export async function adminListPaymentPlayers(
  seasonId?: string | null,
): Promise<AdminPaymentPlayerRow[]> {
  const season = await seasonForPayments(seasonId);
  if (!season) return [];

  const fee = entryFeePkr();
  const rows = await prisma.seasonPlayer.findMany({
    where: {
      seasonId: season.id,
      player: {
        AND: [
          { discordId: { not: { startsWith: DUMMY_PREFIX } } },
          { discordId: { not: { startsWith: DUMMY_TEAM_PREFIX } } },
        ],
      },
    },
    select: {
      rosterRole: true,
      isCaptain: true,
      paidAt: true,
      paymentAmount: true,
      team: { select: { name: true } },
      player: {
        select: {
          id: true,
          steamName: true,
          discordId: true,
        },
      },
    },
    orderBy: [{ team: { name: "asc" } }, { player: { steamName: "asc" } }],
  });

  return rows.map((row) => {
    const mustPay = playerMustPay(row.rosterRole);
    const paid = Boolean(row.paidAt);
    return {
      id: row.player.id,
      discordId: row.player.discordId,
      steamName: row.player.steamName,
      teamName: row.team?.name ?? null,
      rosterRole: row.rosterRole,
      isCaptain: row.isCaptain,
      mustPay,
      paid,
      amount: paid ? row.paymentAmount || fee : mustPay ? fee : 0,
      paidAtLabel: row.paidAt
        ? row.paidAt.toLocaleDateString("en-PK", {
            day: "numeric",
            month: "short",
          })
        : null,
    };
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
  const season = await getLiveSeason();
  if (!season) return [];

  const rows = await prisma.seasonPlayer.findMany({
    where: { seasonId: season.id },
    select: {
      rosterRole: true,
      isCaptain: true,
      paidAt: true,
      paymentAmount: true,
      team: { select: { id: true, name: true } },
      player: {
        select: {
          id: true,
          steamName: true,
          discordName: true,
          discordId: true,
        },
      },
    },
    orderBy: [{ team: { name: "asc" } }, { player: { steamName: "asc" } }],
  });

  return rows
    .map((row) => ({
      id: row.player.id,
      steamName: row.player.steamName,
      discordName: row.player.discordName,
      discordId: row.player.discordId,
      rosterRole: row.rosterRole,
      isCaptain: row.isCaptain,
      paidAt: row.paidAt,
      paymentAmount: row.paymentAmount,
      team: row.team,
    }))
    .filter(
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
  requiredPkr = teamFeePkr(),
): TeamPaymentRow {
  const starters = players.filter((p) => playerMustPay(p.rosterRole));
  const subs = players.filter((p) => !playerMustPay(p.rosterRole));
  const paidPkr = starters
    .filter((p) => p.paidAt)
    .reduce((sum, p) => sum + (p.paymentAmount || entryFeePkr()), 0);
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

export async function listTeamPayments(
  seasonId?: string | null,
): Promise<TeamPaymentRow[]> {
  const season = await seasonForPayments(seasonId);
  if (!season) return [];
  const roster = seasonId?.trim() ? rosterRules(season) : await liveRoster();
  const teams = await prisma.team.findMany({
    where: { seasonId: season.id },
    include: {
      seasonPlayers: {
        select: {
          rosterRole: true,
          isCaptain: true,
          paidAt: true,
          paymentAmount: true,
          player: {
            select: {
              id: true,
              steamName: true,
              discordName: true,
              discordId: true,
            },
          },
          team: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return teams
    .map((team) => {
      const players: PlayerPayRow[] = team.seasonPlayers.map((row) => ({
        id: row.player.id,
        steamName: row.player.steamName,
        discordName: row.player.discordName,
        discordId: row.player.discordId,
        rosterRole: row.rosterRole,
        isCaptain: row.isCaptain,
        paidAt: row.paidAt,
        paymentAmount: row.paymentAmount,
        team: row.team ?? { id: team.id, name: team.name },
      }));
      return { team, players };
    })
    .filter(({ players }) =>
      players.some((p) => !isDummyDiscordId(p.discordId)),
    )
    .map(({ team, players }) =>
      summarizeTeamPayments(team.name, team.id, players, roster.teamFeePkr),
    );
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
    `Team is allowed only at **exactly Rs ${row.requiredPkr.toLocaleString("en-PK")} PKR** (min and max).`,
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
  const required = rows[0]?.requiredPkr;
  const lines = [
    `**Team fees** — min and max **Rs ${(required ?? 0).toLocaleString("en-PK")} PKR** per team.`,
    `**Collected from teams: ${collected.toLocaleString("en-PK")} PKR** · Allowed: **${allowed}/${rows.length}**`,
    ...rows.map(formatTeamPaymentLine),
  ];
  return lines.join("\n");
}

export async function getPaymentCollection(seasonId?: string | null) {
  const season = await seasonForPayments(seasonId);
  if (!season) {
    return {
      collected: 0,
      expected: 0,
      owed: 0,
      paidCount: 0,
      unpaidCount: 0,
      starterCount: 0,
      teamsAllowed: 0,
      teamCount: 0,
      paid: [] as { steamName: string; team: { name: string } | null }[],
      unpaid: [] as { steamName: string; team: { name: string } | null }[],
      teams: [] as TeamPaymentRow[],
      seasonName: null as string | null,
    };
  }

  const fee = entryFeePkr();
  const rows = await prisma.seasonPlayer.findMany({
    where: {
      seasonId: season.id,
      player: {
        AND: [
          { discordId: { not: { startsWith: DUMMY_PREFIX } } },
          { discordId: { not: { startsWith: DUMMY_TEAM_PREFIX } } },
        ],
      },
    },
    select: {
      rosterRole: true,
      paidAt: true,
      paymentAmount: true,
      player: { select: { steamName: true } },
      team: { select: { name: true } },
    },
    orderBy: [{ player: { steamName: "asc" } }],
  });

  const starters = rows.filter((p) => playerMustPay(p.rosterRole));
  const paid = starters
    .filter((p) => p.paidAt)
    .map((p) => ({
      steamName: p.player.steamName,
      rosterRole: p.rosterRole,
      paidAt: p.paidAt,
      paymentAmount: p.paymentAmount,
      team: p.team,
    }));
  const unpaid = starters
    .filter((p) => !p.paidAt)
    .map((p) => ({
      steamName: p.player.steamName,
      rosterRole: p.rosterRole,
      paidAt: p.paidAt,
      paymentAmount: p.paymentAmount,
      team: p.team,
    }));
  const collected = paid.reduce(
    (sum, p) => sum + (p.paymentAmount || fee),
    0,
  );
  const expected = starters.length * fee;
  const owed = unpaid.length * fee;
  const teams = await listTeamPayments(season.id);
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
    seasonName: season.name,
  };
}

export function formatPaymentCollection(
  data: Awaited<ReturnType<typeof getPaymentCollection>>,
) {
  const lines = [
    data.seasonName ? `**Money collected** · ${data.seasonName}` : "**Money collected**",
    `**In: ${data.collected.toLocaleString("en-PK")} PKR** (${data.paidCount} paid)`,
    `Still owed: **${data.owed.toLocaleString("en-PK")} PKR** (${data.unpaidCount} unpaid)`,
    `Expected from registered starters: **${data.expected.toLocaleString("en-PK")} PKR** (${data.starterCount} × ${formatEntryFee()})`,
    `Teams at the exact fee: **${data.teamsAllowed}/${data.teamCount}**`,
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

/** Active-season payment state for a player (admin detail). */
export async function getActiveSeasonPaymentForPlayer(playerId: string) {
  const season = await getLiveSeason();
  if (!season) return null;
  return prisma.seasonPlayer.findUnique({
    where: {
      seasonId_playerId: { seasonId: season.id, playerId },
    },
    include: {
      season: { select: { id: true, number: true, name: true } },
      team: { select: { id: true, name: true } },
    },
  });
}
