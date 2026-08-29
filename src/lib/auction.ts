import {
  BID_CLOCK_SECONDS,
  BID_INCREMENT,
  MAX_ROSTER,
  MIN_ROSTER,
  ROLE_LABELS,
  basePriceFor,
  parseRole,
  type Role,
} from "./constants";
import { prisma } from "./prisma";
import { isEligibleForLot, parseRolesJson } from "./roles";
import { rebalanceTeamRoster } from "./players-admin";

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
  role: Role;
  balances: TeamBalance[];
};

type LiveAuction = {
  status: "idle" | "running" | "paused";
  role: Role | null;
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
};

let live: LiveAuction | null = null;

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

function requireLive() {
  if (!live || live.status === "idle" || !live.currentPlayerId) {
    throw new Error("No player is on the block.");
  }
  return live;
}

function openLotInMemory(auction: LiveAuction, playerId: string) {
  const player = auction.players.get(playerId);
  if (!player) throw new Error("Player not found in this auction.");
  auction.status = "running";
  auction.currentPlayerId = playerId;
  auction.currentBid = basePriceFor(player.medal);
  auction.currentBidderTeamId = null;
  auction.endsAtMs = nowEndsAt();
  auction.event = auction.event === "sold" || auction.event === "unsold"
    ? auction.event
    : "lot";
}

function viewFromLive() {
  const auction = live;
  if (!auction) {
    return {
      status: "idle" as const,
      role: null,
      secondsLeft: 0,
      endsAt: null,
      currentBid: 0,
      currentPlayer: null,
      highBidder: null,
      remainingInRole: 0,
      event: "idle" as const,
      lastSale: null,
      teamBalances: [],
      channelId: null,
      messageId: null,
    };
  }
  const player = auction.currentPlayerId
    ? auction.players.get(auction.currentPlayerId) ?? null
    : null;
  const bidder = auction.currentBidderTeamId
    ? auction.teams.get(auction.currentBidderTeamId) ?? null
    : null;
  return {
    status: auction.status,
    role: auction.role,
    secondsLeft: secondsLeft(auction.endsAtMs),
    endsAt: auction.endsAtMs ? new Date(auction.endsAtMs) : null,
    currentBid: auction.currentBid,
    currentPlayer: player,
    highBidder: bidder ? { name: bidder.name } : null,
    remainingInRole: auction.queue.length,
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

  if (kind === "sold" && team) {
    await prisma.$transaction([
      prisma.team.update({
        where: { id: team.id },
        data: { purse: team.purse },
      }),
      prisma.player.update({
        where: { id: playerId },
        data: {
          teamId: team.id,
          rosterRole: team.rosterCount > MIN_ROSTER ? "sub" : null,
        },
      }),
      prisma.auctionLot.create({
        data: {
          role: auction.role ?? "safelane",
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
        role: auction.role ?? "safelane",
        playerId,
        status: "unsold",
      },
    });
  }

  auction.lastSale = {
    playerName: player?.steamName ?? "Player",
    teamName: kind === "sold" ? team?.name ?? null : null,
    price: kind === "sold" ? auction.currentBid : null,
    medal: player?.medal ?? "",
    role: auction.role ?? "safelane",
    balances: teamBalances(auction),
  };
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

async function settleCurrent(kind: "sold" | "unsold") {
  const auction = requireLive();
  if (kind === "sold" && auction.currentBidderTeamId) {
    const team = auction.teams.get(auction.currentBidderTeamId);
    if (!team) throw new Error("Winning team is gone.");
    if (team.rosterCount >= MAX_ROSTER || team.purse < auction.currentBid) {
      kind = "unsold";
    } else {
      team.purse -= auction.currentBid;
      team.rosterCount += 1;
    }
  }
  auction.event = kind;
  try {
    await persistSale(auction, kind);
  } catch (error) {
    console.error("auction persist", error);
  }
  advanceInMemory(auction);
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

export async function startAuction(roleInput: string) {
  if (live?.status === "running") {
    throw new Error(
      `Auction already running for ${ROLE_LABELS[live.role as Role] ?? live.role}. Pause or finish it first.`,
    );
  }

  const role = parseRole(roleInput);
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
    .filter((p) => isEligibleForLot(parseRolesJson(p.rolesJson), role))
    .sort((a, b) => basePriceFor(b.medal) - basePriceFor(a.medal));
  if (eligible.length === 0) {
    throw new Error(
      `No unsigned players listed for ${ROLE_LABELS[role]} (or flex).`,
    );
  }

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
    teams.map((t) => [
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
  for (const team of teams) {
    const captain = team.players.find((p) => p.isCaptain);
    if (captain) {
      captainMap.set(captain.discordId, {
        playerId: captain.id,
        discordId: captain.discordId,
        teamId: team.id,
      });
    }
  }

  const queue = eligible.map((p) => p.id);
  const first = queue.shift()!;
  live = {
    status: "running",
    role,
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
  };
  openLotInMemory(live, first);
  live.event = "lot";
  return viewFromLive();
}

export async function pauseAuction() {
  const auction = requireLive();
  if (auction.status !== "running") {
    throw new Error("No live auction to pause.");
  }
  auction.status = "paused";
  auction.event = "bid";
  return viewFromLive();
}

export async function resumeAuction() {
  if (!live || live.status !== "paused") {
    throw new Error("Auction is not paused.");
  }
  live.status = "running";
  live.endsAtMs = nowEndsAt();
  live.event = "lot";
  return viewFromLive();
}

export async function skipLot() {
  requireLive();
  await settleCurrent("unsold");
  return viewFromLive();
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
}) {
  const auction = requireLive();
  if (auction.status !== "running") {
    throw new Error("Auction is not running.");
  }
  if (auction.endsAtMs && auction.endsAtMs <= Date.now()) {
    throw new Error("Clock already expired. Wait for the next lot.");
  }

  const captain = auction.captains.get(input.discordId);
  if (!captain) {
    throw new Error("Only captains can bid.");
  }
  const team = auction.teams.get(captain.teamId);
  if (!team) {
    throw new Error("Your team was not found.");
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
    throw new Error("You are already the high bidder.");
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
  return viewFromLive();
}

export async function tickAuction() {
  if (!live || live.status !== "running" || !live.endsAtMs) {
    return { changed: false };
  }
  if (live.endsAtMs > Date.now() + 250) {
    return { changed: false };
  }
  const kind = live.currentBidderTeamId ? "sold" : "unsold";
  await settleCurrent(kind);
  return { changed: true, kind };
}

export function saveAuctionMessage(channelId: string, messageId: string) {
  if (!live) return;
  live.channelId = channelId;
  live.messageId = messageId;
}

export function clearAuctionMessage() {
  if (live) live.messageId = null;
}

export function getAuctionView() {
  return viewFromLive();
}

export function markAuctionAnnounced() {
  if (!live) return;
  if (live.event === "sold" || live.event === "unsold" || live.event === "lot") {
    live.event = live.status === "running" ? "bid" : "idle";
  }
}
