import {
  BID_CLOCK_SECONDS,
  BID_INCREMENT,
  MAX_ROSTER,
  MIN_ROSTER,
  MEDAL_LABELS,
  ROLE_LABELS,
  STARTING_PURSE,
  STARTING_ROLES,
  basePriceFor,
  parseMedal,
  type Medal,
} from "./constants";
import { prisma } from "./prisma";
import { stringifyRoles } from "./roles";
import { currentSeasonId, currentSeasonFilter, syncSeasonPlayer } from "./seasons";
import { getCupFeatureSettings } from "./cup-features";
import { rebalanceTeamRoster } from "./players-admin";
import { notifySiteRefresh } from "./notify-site";

const DUMMY_PLAYER_PREFIX = "test-dummy-";
const DUMMY_TEAM_PREFIX = "test-dummy-team-";

type LivePlayer = {
  id: string;
  steamName: string;
  medal: string;
  rolesJson: string;
};

type LiveTeam = {
  id: string;
  name: string;
  purse: number;
  rosterCount: number;
};

type LiveCaptain = {
  playerId: string;
  discordId: string;
  teamId: string;
};

type TeamBalance = {
  name: string;
  purse: number;
  rosterCount: number;
};

type LiveSale = {
  playerName: string;
  teamName: string | null;
  price: number | null;
  medal: string;
  rolesJson: string;
  balances: TeamBalance[];
};

type LiveAuction = {
  sandbox: boolean;
  status: "idle" | "running" | "paused";
  medal: Medal | null;
  queue: string[];
  currentPlayerId: string | null;
  currentBid: number;
  currentBidderTeamId: string | null;
  endsAtMs: number | null;
  channelId: string | null;
  messageId: string | null;
  players: Map<string, LivePlayer>;
  teams: Map<string, LiveTeam>;
  captains: Map<string, LiveCaptain>;
  event: "idle" | "lot" | "bid" | "sold" | "unsold" | "done";
  lastSale: LiveSale | null;
  busy: boolean;
  awaitingDecision: boolean;
};

type AuctionOpts = { sandbox?: boolean };

let live: LiveAuction | null = null;
let dummy: LiveAuction | null = null;

const SANDBOX_TEAMS: { id: string; name: string }[] = [
  { id: "sandbox-team-liquid", name: "Test Liquid" },
  { id: "sandbox-team-og", name: "Test OG" },
  { id: "sandbox-team-secret", name: "Test Secret" },
];

function isDummyDiscordId(discordId: string) {
  return (
    discordId.startsWith(DUMMY_PLAYER_PREFIX) ||
    discordId.startsWith(DUMMY_TEAM_PREFIX)
  );
}

function session(sandbox?: boolean) {
  return sandbox ? dummy : live;
}

function teamBalances(auction: LiveAuction): TeamBalance[] {
  return [...auction.teams.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({
      name: t.name,
      purse: t.purse,
      rosterCount: t.rosterCount,
    }));
}

function nowEndsAt() {
  return Date.now() + BID_CLOCK_SECONDS * 1000;
}

function secondsLeft(endsAtMs: number | null) {
  if (!endsAtMs) return 0;
  return Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
}

function requireSession(sandbox?: boolean) {
  const auction = session(sandbox);
  if (!auction || auction.status === "idle" || !auction.currentPlayerId) {
    throw new Error(
      sandbox
        ? "No test player is on the block. In **#auction-test** run `/auction start`."
        : "No player is on the block.",
    );
  }
  return auction;
}

function openLotInMemory(auction: LiveAuction, playerId: string) {
  const player = auction.players.get(playerId);
  if (!player) throw new Error("Player not found in this auction.");
  auction.status = "running";
  auction.currentPlayerId = playerId;
  auction.currentBid = basePriceFor(player.medal);
  auction.currentBidderTeamId = null;
  auction.endsAtMs = nowEndsAt();
  auction.awaitingDecision = false;
  auction.event =
    auction.event === "sold" || auction.event === "unsold"
      ? auction.event
      : "lot";
}

function findCaptain(auction: LiveAuction, discordId: string) {
  const direct = auction.captains.get(discordId);
  if (direct) return direct;
  const snowflake = discordId.split(":")[0];
  for (const captain of auction.captains.values()) {
    if (captain.discordId.split(":")[0] === snowflake) return captain;
  }
  return null;
}

function requireLot(auction: LiveAuction, lotId?: string | null) {
  if (lotId && auction.currentPlayerId && lotId !== auction.currentPlayerId) {
    throw new Error("This lot is already over. Use the latest card.");
  }
}

function idleView(sandbox: boolean) {
  return {
    sandbox,
    status: "idle" as const,
    medal: null,
    secondsLeft: 0,
    endsAt: null,
    currentBid: 0,
    currentPlayer: null,
    lotId: null,
    highBidder: null,
    remainingInPool: 0,
    awaitingDecision: false,
    event: "idle" as const,
    lastSale: null,
    teamBalances: [],
    channelId: null,
    messageId: null,
  };
}

function viewFromSession(auction: LiveAuction | null, sandbox: boolean) {
  if (!auction) return idleView(sandbox);
  const player = auction.currentPlayerId
    ? (auction.players.get(auction.currentPlayerId) ?? null)
    : null;
  const bidder = auction.currentBidderTeamId
    ? (auction.teams.get(auction.currentBidderTeamId) ?? null)
    : null;
  return {
    sandbox: auction.sandbox,
    status: auction.status,
    medal: auction.medal,
    secondsLeft: secondsLeft(auction.endsAtMs),
    endsAt: auction.endsAtMs ? new Date(auction.endsAtMs) : null,
    currentBid: auction.currentBid,
    currentPlayer: player,
    lotId: auction.currentPlayerId,
    highBidder: bidder ? { name: bidder.name } : null,
    remainingInPool: auction.queue.length,
    awaitingDecision: auction.awaitingDecision,
    event: auction.event,
    lastSale: auction.lastSale,
    teamBalances: teamBalances(auction),
    channelId: auction.channelId,
    messageId: auction.messageId,
  };
}

async function persistSale(auction: LiveAuction, kind: "sold" | "unsold") {
  const playerId = auction.currentPlayerId;
  if (!playerId) return;
  const player = auction.players.get(playerId);
  const team = auction.currentBidderTeamId
    ? auction.teams.get(auction.currentBidderTeamId)
    : null;

  auction.lastSale = {
    playerName: player?.steamName ?? "Player",
    teamName: kind === "sold" ? (team?.name ?? null) : null,
    price: kind === "sold" ? auction.currentBid : null,
    medal: player?.medal ?? auction.medal ?? "",
    rolesJson: player?.rolesJson ?? "[]",
    balances: teamBalances(auction),
  };

  if (auction.sandbox) return;

  const pool = auction.medal ?? player?.medal ?? "uncalibrated";
  const existing = await prisma.player.findUnique({
    where: { id: playerId },
    select: { teamId: true },
  });
  const alreadySold = await prisma.auctionLot.findFirst({
    where: { playerId, status: "sold" },
    select: { id: true },
  });
  if (existing?.teamId || alreadySold) {
    console.warn("auction persist skipped — player already sold", playerId);
    return;
  }

  if (kind === "sold" && team) {
    const seasonId = await currentSeasonId();
    await prisma.$transaction([
      prisma.team.update({
        where: { id: team.id },
        data: { purse: team.purse },
      }),
      prisma.player.update({
        where: { id: playerId },
        data: {
          teamId: team.id,
          teamJoinedAt: new Date(),
          rosterRole: team.rosterCount > MIN_ROSTER ? "sub" : null,
        },
      }),
      prisma.auctionLot.create({
        data: {
          seasonId,
          role: pool,
          playerId,
          teamId: team.id,
          soldPrice: auction.currentBid,
          status: "sold",
        },
      }),
    ]);
    await rebalanceTeamRoster(team.id);
  } else {
    await prisma.auctionLot.create({
      data: {
        seasonId: await currentSeasonId(),
        role: pool,
        playerId,
        status: "unsold",
      },
    });
  }
  void notifySiteRefresh();
}

function advanceInMemory(auction: LiveAuction) {
  const nextId = auction.queue.shift();
  if (!nextId) {
    auction.status = "idle";
    auction.currentPlayerId = null;
    auction.currentBidderTeamId = null;
    auction.endsAtMs = null;
    auction.event = "done";
    return;
  }
  openLotInMemory(auction, nextId);
}

async function settleCurrent(kind: "sold" | "unsold", sandbox?: boolean) {
  const auction = requireSession(sandbox);
  if (auction.busy) {
    throw new Error("This lot is already being closed. Wait a moment.");
  }
  auction.busy = true;
  const playerId = auction.currentPlayerId;
  const teamId = auction.currentBidderTeamId;
  const team = teamId ? auction.teams.get(teamId) : null;
  const purseBefore = team?.purse;
  const rosterBefore = team?.rosterCount;
  try {
    if (kind === "sold" && team) {
      if (team.rosterCount >= MAX_ROSTER || team.purse < auction.currentBid) {
        kind = "unsold";
      } else {
        team.purse -= auction.currentBid;
        team.rosterCount += 1;
      }
    }
    auction.event = kind;
    auction.awaitingDecision = false;
    await persistSale(auction, kind);
    if (auction.currentPlayerId !== playerId) {
      return;
    }
    advanceInMemory(auction);
  } catch (error) {
    if (team && purseBefore != null && rosterBefore != null) {
      team.purse = purseBefore;
      team.rosterCount = rosterBefore;
    }
    auction.awaitingDecision = true;
    console.error("auction persist", error);
    throw new Error(
      "Could not save that sale. Purse was not changed. Try Confirm or Skip again.",
    );
  } finally {
    auction.busy = false;
  }
}

function buildSandboxPlayers(medal: Medal): LivePlayer[] {
  return STARTING_ROLES.map((role, index) => ({
    id: `sandbox-player-${medal}-${index}`,
    steamName: `Test ${MEDAL_LABELS[medal]} ${ROLE_LABELS[role]}`,
    medal,
    rolesJson: stringifyRoles([role]),
  }));
}

function buildSandboxTeams(): Map<string, LiveTeam> {
  return new Map(
    SANDBOX_TEAMS.map((team) => [
      team.id,
      {
        id: team.id,
        name: team.name,
        purse: STARTING_PURSE,
        rosterCount: 1,
      },
    ]),
  );
}

function pickSandboxTeam(
  auction: LiveAuction,
  discordId: string,
  teamName?: string | null,
) {
  if (teamName?.trim()) {
    const q = teamName.trim().toLowerCase();
    const team =
      [...auction.teams.values()].find((t) => t.name.toLowerCase() === q) ??
      [...auction.teams.values()].find((t) => t.name.toLowerCase().includes(q));
    if (!team) {
      throw new Error(
        `No dummy team matching **${teamName}**. Use **Test Liquid**, **Test OG**, or **Test Secret**.`,
      );
    }
    auction.captains.set(discordId, {
      playerId: `sandbox-admin-${discordId}`,
      discordId,
      teamId: team.id,
    });
    return team;
  }

  const existing = auction.captains.get(discordId);
  if (existing) {
    const team = auction.teams.get(existing.teamId);
    if (team) return team;
  }

  const taken = new Set(
    [...auction.captains.entries()]
      .filter(([id]) => id !== discordId)
      .map(([, captain]) => captain.teamId),
  );
  const team =
    [...auction.teams.values()].find((t) => !taken.has(t.id)) ??
    [...auction.teams.values()][0];
  if (!team) throw new Error("No dummy teams in this test auction.");
  auction.captains.set(discordId, {
    playerId: `sandbox-admin-${discordId}`,
    discordId,
    teamId: team.id,
  });
  return team;
}

function nextSandboxTeam(
  auction: LiveAuction,
  currentTeamId: string,
  minPurse: number,
) {
  const teams = [...auction.teams.values()];
  const start = teams.findIndex((t) => t.id === currentTeamId);
  for (let i = 1; i <= teams.length; i++) {
    const team = teams[(start + i) % teams.length];
    if (
      team &&
      team.id !== currentTeamId &&
      team.rosterCount < MAX_ROSTER &&
      team.purse >= minPurse
    ) {
      return team;
    }
  }
  return null;
}

export async function ensureAuctionState() {
  return prisma.auctionState.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

export async function hydrateAuctionClock() {
  /* live auction is in memory; nothing to load */
}

export async function repairAuctionScores() {
  const [teams, lots] = await Promise.all([
    prisma.team.findMany({
      include: {
        players: { select: { discordId: true } },
      },
    }),
    prisma.auctionLot.findMany({
      where: { status: "sold" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        playerId: true,
        teamId: true,
        soldPrice: true,
      },
    }),
  ]);

  const seenPlayer = new Set<string>();
  const duplicateIds: string[] = [];
  const spentByTeam = new Map<string, number>();
  for (const lot of lots) {
    if (seenPlayer.has(lot.playerId)) {
      duplicateIds.push(lot.id);
      continue;
    }
    seenPlayer.add(lot.playerId);
    if (!lot.teamId) continue;
    spentByTeam.set(
      lot.teamId,
      (spentByTeam.get(lot.teamId) ?? 0) + (lot.soldPrice ?? 0),
    );
  }

  if (duplicateIds.length > 0) {
    await prisma.auctionLot.deleteMany({ where: { id: { in: duplicateIds } } });
  }

  const fixed: { name: string; from: number; to: number }[] = [];
  for (const team of teams) {
    if (
      team.players.some(
        (p) =>
          p.discordId.startsWith(DUMMY_PLAYER_PREFIX) ||
          p.discordId.startsWith(DUMMY_TEAM_PREFIX),
      )
    ) {
      continue;
    }
    const expected = STARTING_PURSE - (spentByTeam.get(team.id) ?? 0);
    if (team.purse !== expected) {
      await prisma.team.update({
        where: { id: team.id },
        data: { purse: expected },
      });
      fixed.push({ name: team.name, from: team.purse, to: expected });
    }
  }

  return { duplicateLotsRemoved: duplicateIds.length, pursesFixed: fixed };
}

export async function revertSoldAuctionPlayers(steamNames: string[]) {
  const reverted: {
    steamName: string;
    fromTeam: string;
    refunded: number;
  }[] = [];

  for (const raw of steamNames) {
    const q = raw.trim();
    if (!q) continue;
    const player =
      (await prisma.player.findFirst({
        where: {
          steamName: { equals: q, mode: "insensitive" },
          isCaptain: false,
        },
      })) ??
      (await prisma.player.findFirst({
        where: {
          steamName: { contains: q, mode: "insensitive" },
          isCaptain: false,
        },
      }));
    if (!player) {
      throw new Error(`No non-captain player matching **${q}**.`);
    }
    const lot = await prisma.auctionLot.findFirst({
      where: { playerId: player.id, status: "sold" },
      orderBy: { createdAt: "asc" },
    });
    const teamId = player.teamId ?? lot?.teamId;
    const team = teamId
      ? await prisma.team.findUnique({ where: { id: teamId } })
      : null;
    const refunded = lot?.soldPrice ?? 0;

    await prisma.auctionLot.deleteMany({ where: { playerId: player.id } });
    await prisma.player.update({
      where: { id: player.id },
      data: { teamId: null, rosterRole: null, teamJoinedAt: null },
    });
    if (teamId) await rebalanceTeamRoster(teamId);
    await syncSeasonPlayer(player.id);

    if (live && teamId) {
      const mem = live.teams.get(teamId);
      if (mem) {
        mem.rosterCount = Math.max(1, mem.rosterCount - 1);
        mem.purse += refunded;
      }
      live.players.set(player.id, {
        id: player.id,
        steamName: player.steamName,
        medal: player.medal,
        rolesJson: player.rolesJson,
      });
      if (live.medal && player.medal.toLowerCase() === live.medal) {
        if (
          live.currentPlayerId !== player.id &&
          !live.queue.includes(player.id)
        ) {
          live.queue.push(player.id);
        }
      }
    }

    reverted.push({
      steamName: player.steamName,
      fromTeam: team?.name ?? "unsigned",
      refunded,
    });
  }

  const scores = await repairAuctionScores();
  if (live) {
    const teams = await prisma.team.findMany({
      include: { _count: { select: { players: true } } },
    });
    for (const team of teams) {
      const mem = live.teams.get(team.id);
      if (!mem) continue;
      mem.purse = team.purse;
      mem.rosterCount = team._count.players;
    }
  }
  return { reverted, scores };
}

export async function restoreSoldAuctionPlayers(
  rows: { steamName: string; teamName: string; price: number }[],
) {
  const restored: {
    steamName: string;
    teamName: string;
    price: number;
  }[] = [];

  for (const row of rows) {
    const player =
      (await prisma.player.findFirst({
        where: {
          steamName: { equals: row.steamName.trim(), mode: "insensitive" },
          isCaptain: false,
        },
      })) ??
      (await prisma.player.findFirst({
        where: {
          steamName: { contains: row.steamName.trim(), mode: "insensitive" },
          isCaptain: false,
        },
      }));
    if (!player) {
      throw new Error(`No non-captain player matching **${row.steamName}**.`);
    }

    const team = await prisma.team.findFirst({
      where: {
        name: { equals: row.teamName.trim(), mode: "insensitive" },
        ...(await currentSeasonFilter()),
      },
      include: { players: true },
    });
    if (!team) {
      throw new Error(`Team **${row.teamName}** not found.`);
    }
    if (player.teamId && player.teamId !== team.id) {
      throw new Error(
        `**${player.steamName}** is already on another team. Revert them first.`,
      );
    }

    if (!player.teamId) {
      if (team.players.length >= MAX_ROSTER) {
        throw new Error(`**${team.name}** is full.`);
      }
      await prisma.player.update({
        where: { id: player.id },
        data: {
          teamId: team.id,
          teamJoinedAt: new Date(),
          rosterRole: team.players.length >= MIN_ROSTER ? "sub" : null,
        },
      });
      await rebalanceTeamRoster(team.id);
    }

    const alreadySold = await prisma.auctionLot.findFirst({
      where: { playerId: player.id, status: "sold" },
    });
    if (!alreadySold) {
      await prisma.auctionLot.create({
        data: {
          seasonId: await currentSeasonId(),
          role: player.medal,
          playerId: player.id,
          teamId: team.id,
          soldPrice: row.price,
          status: "sold",
        },
      });
    }

    if (live) {
      live.queue = live.queue.filter((id) => id !== player.id);
      live.players.delete(player.id);
      if (live.currentPlayerId === player.id) {
        live.currentPlayerId = null;
      }
    }

    restored.push({
      steamName: player.steamName,
      teamName: team.name,
      price: alreadySold?.soldPrice ?? row.price,
    });
  }

  const scores = await repairAuctionScores();
  if (live) {
    const teams = await prisma.team.findMany({
      include: { _count: { select: { players: true } } },
    });
    for (const team of teams) {
      const mem = live.teams.get(team.id);
      if (!mem) continue;
      mem.purse = team.purse;
      mem.rosterCount = team._count.players;
    }
  }
  return { restored, scores };
}

export async function startAuction(rankInput: string, options?: AuctionOpts) {
  const sandbox = Boolean(options?.sandbox);
  if (!sandbox) {
    const { auctionEnabled } = await getCupFeatureSettings();
    if (!auctionEnabled) {
      throw new Error(
        "Auction is turned off for this cup. Assign players with `/player add`, or turn auction on with `/cup auction on`.",
      );
    }
  }
  const current = session(sandbox);
  if (current && (current.status === "running" || current.status === "paused")) {
    const label = current.medal ? MEDAL_LABELS[current.medal] : "this rank";
    throw new Error(
      sandbox
        ? `Test auction already running for ${label}. Pause or finish it first.`
        : `Auction already running for ${label}. Pause or finish it first.`,
    );
  }

  const medal = parseMedal(rankInput);
  if (!sandbox) {
    await repairAuctionScores();
  }

  if (sandbox) {
    const eligible = buildSandboxPlayers(medal);
    const playerMap = new Map(eligible.map((p) => [p.id, p]));
    const queue = eligible.map((p) => p.id);
    const first = queue.shift()!;
    dummy = {
      sandbox: true,
      status: "running",
      medal,
      queue,
      currentPlayerId: first,
      currentBid: 0,
      currentBidderTeamId: null,
      endsAtMs: null,
      channelId: null,
      messageId: null,
      players: playerMap,
      teams: buildSandboxTeams(),
      captains: new Map(),
      event: "lot",
      lastSale: null,
      busy: false,
      awaitingDecision: false,
    };
    openLotInMemory(dummy, first);
    dummy.event = "lot";
    return viewFromSession(dummy, true);
  }

  const [unsigned, teams] = await Promise.all([
    prisma.player.findMany({
      where: { teamId: null },
      orderBy: { steamName: "asc" },
    }),
    prisma.team.findMany({
      include: { players: true },
    }),
  ]);

  const eligible = unsigned
    .filter((p) => !isDummyDiscordId(p.discordId))
    .filter((p) => p.medal.toLowerCase() === medal);
  if (eligible.length === 0) {
    throw new Error(
      `No unsigned players at **${MEDAL_LABELS[medal]}**.`,
    );
  }

  const liveTeams = teams.filter((team) =>
    team.players.some((p) => !isDummyDiscordId(p.discordId)),
  );

  const playerMap = new Map(
    eligible.map((p) => [
      p.id,
      {
        id: p.id,
        steamName: p.steamName,
        medal: p.medal,
        rolesJson: p.rolesJson,
      },
    ]),
  );
  const teamMap = new Map(
    liveTeams.map((t) => [
      t.id,
      {
        id: t.id,
        name: t.name,
        purse: t.purse,
        rosterCount: t.players.length,
      },
    ]),
  );
  const captainMap = new Map<string, LiveCaptain>();
  for (const team of liveTeams) {
    const captain = team.players.find((p) => p.isCaptain);
    if (captain && !isDummyDiscordId(captain.discordId)) {
      const record = {
        playerId: captain.id,
        discordId: captain.discordId,
        teamId: team.id,
      };
      captainMap.set(captain.discordId, record);
      captainMap.set(captain.discordId.split(":")[0], record);
    }
  }

  const queue = eligible.map((p) => p.id);
  const first = queue.shift()!;
  live = {
    sandbox: false,
    status: "running",
    medal,
    queue,
    currentPlayerId: first,
    currentBid: 0,
    currentBidderTeamId: null,
    endsAtMs: null,
    channelId: null,
    messageId: null,
    players: playerMap,
    teams: teamMap,
    captains: captainMap,
    event: "lot",
    lastSale: null,
    busy: false,
    awaitingDecision: false,
  };
  openLotInMemory(live, first);
  live.event = "lot";
  return viewFromSession(live, false);
}

export async function pauseAuction(options?: AuctionOpts) {
  const auction = requireSession(options?.sandbox);
  if (auction.status !== "running") {
    throw new Error(
      options?.sandbox
        ? "No test auction to pause."
        : "No live auction to pause.",
    );
  }
  auction.status = "paused";
  auction.event = "bid";
  return viewFromSession(auction, auction.sandbox);
}

export async function resumeAuction(options?: AuctionOpts) {
  const auction = session(options?.sandbox);
  if (!auction || auction.status !== "paused") {
    throw new Error(
      options?.sandbox ? "Test auction is not paused." : "Auction is not paused.",
    );
  }
  auction.status = "running";
  if (!auction.awaitingDecision) {
    auction.endsAtMs = nowEndsAt();
  }
  auction.event = "bid";
  return viewFromSession(auction, auction.sandbox);
}

export async function skipLot(options?: AuctionOpts & { lotId?: string | null }) {
  const auction = requireSession(options?.sandbox);
  requireLot(auction, options?.lotId);
  await settleCurrent("unsold", options?.sandbox);
  return getAuctionView(options?.sandbox);
}

export async function confirmLot(options?: AuctionOpts & { lotId?: string | null }) {
  const auction = requireSession(options?.sandbox);
  requireLot(auction, options?.lotId);
  if (!auction.currentBidderTeamId) {
    throw new Error("No high bidder. Use **Skip** to pass this player.");
  }
  await settleCurrent("sold", options?.sandbox);
  return getAuctionView(options?.sandbox);
}

export async function undoLastSale(): Promise<never> {
  throw new Error(
    "Undo is paused during live testing. Skip or restart the role if needed.",
  );
}

export function placeBid(input: {
  discordId: string;
  amount?: number;
  bump?: number;
  sandbox?: boolean;
  teamName?: string | null;
  lotId?: string | null;
}) {
  const auction = requireSession(input.sandbox);
  requireLot(auction, input.lotId);
  if (auction.busy) {
    throw new Error("This lot is closing. Wait for Confirm/Skip to finish.");
  }
  if (auction.status !== "running") {
    throw new Error(
      input.sandbox ? "Test auction is paused." : "Auction is paused. Admin: `/auction resume`.",
    );
  }
  if (auction.awaitingDecision) {
    throw new Error("Clock ended. Admin must **Confirm** the sale or **Skip**.");
  }
  if (auction.endsAtMs && auction.endsAtMs <= Date.now()) {
    auction.awaitingDecision = true;
    throw new Error("Clock ended. Admin must **Confirm** the sale or **Skip**.");
  }

  let team: LiveTeam;
  if (auction.sandbox) {
    team = pickSandboxTeam(auction, input.discordId, input.teamName);
  } else {
    const captain = findCaptain(auction, input.discordId);
    if (!captain) {
      throw new Error("Only captains can bid.");
    }
    const found = auction.teams.get(captain.teamId);
    if (!found) {
      throw new Error("Your team was not found.");
    }
    team = found;
  }

  if (team.rosterCount >= MAX_ROSTER) {
    throw new Error(
      `**${team.name}** is full (${MAX_ROSTER}/${MAX_ROSTER}). You cannot buy another player.`,
    );
  }

  let next: number;
  if (input.bump) {
    next = auction.currentBidderTeamId
      ? auction.currentBid + input.bump
      : auction.currentBid;
  } else if (input.amount != null) {
    next = input.amount;
  } else {
    next = auction.currentBidderTeamId
      ? auction.currentBid + BID_INCREMENT
      : auction.currentBid;
  }

  if (!auction.currentBidderTeamId) {
    if (next < auction.currentBid) {
      throw new Error(`Opening bid must be at least ${auction.currentBid}.`);
    }
  } else if (next < auction.currentBid + BID_INCREMENT) {
    throw new Error(`Bid must be at least ${auction.currentBid + BID_INCREMENT}.`);
  }

  if (team.id === auction.currentBidderTeamId) {
    if (auction.sandbox) {
      const switched = nextSandboxTeam(auction, team.id, next);
      if (!switched) {
        throw new Error("You are already the high bidder.");
      }
      team = switched;
      auction.captains.set(input.discordId, {
        playerId: `sandbox-admin-${input.discordId}`,
        discordId: input.discordId,
        teamId: switched.id,
      });
    } else {
      throw new Error("You are already the high bidder.");
    }
  }
  if (team.purse < next) {
    throw new Error(
      `**${team.name}** does not have enough money to buy this player. Purse left: **${team.purse}**. This bid: **${next}**.`,
    );
  }

  auction.currentBid = next;
  auction.currentBidderTeamId = team.id;
  auction.endsAtMs = nowEndsAt();
  auction.event = "bid";
  return viewFromSession(auction, auction.sandbox);
}

export async function tickAuction(sandbox = false) {
  const auction = session(sandbox);
  if (!auction || auction.busy) {
    return { changed: false };
  }
  if (auction.status !== "running" || !auction.endsAtMs) {
    return { changed: false };
  }
  if (auction.awaitingDecision) {
    return { changed: false };
  }
  if (auction.endsAtMs > Date.now() + 250) {
    return { changed: false };
  }
  auction.awaitingDecision = true;
  auction.event = "bid";
  return { changed: true };
}

export function saveAuctionMessage(
  channelId: string,
  messageId: string,
  sandbox = false,
) {
  const auction = session(sandbox);
  if (!auction) return;
  auction.channelId = channelId;
  auction.messageId = messageId;
}

export function clearAuctionMessage(sandbox = false) {
  const auction = session(sandbox);
  if (auction) auction.messageId = null;
}

export function patchLivePlayer(
  playerId: string,
  patch: { medal?: string; rolesJson?: string },
) {
  if (!live) return { patched: false, bidReset: false };
  const player = live.players.get(playerId);
  if (!player) return { patched: false, bidReset: false };
  if (patch.medal) player.medal = patch.medal;
  if (patch.rolesJson) player.rolesJson = patch.rolesJson;

  let bidReset = false;
  if (
    patch.medal &&
    live.currentPlayerId === playerId &&
    !live.currentBidderTeamId
  ) {
    live.currentBid = basePriceFor(player.medal);
    bidReset = true;
  }
  return { patched: true, bidReset };
}

export function getAuctionView(sandbox = false) {
  return viewFromSession(session(sandbox), sandbox);
}

export function markAuctionAnnounced(sandbox = false) {
  const auction = session(sandbox);
  if (!auction) return;
  if (auction.event === "sold" || auction.event === "unsold" || auction.event === "lot") {
    auction.event = auction.status === "running" ? "bid" : "idle";
  }
}
