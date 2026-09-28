import { randomBytes } from "node:crypto";
import {
  BID_CLOCK_SECONDS,
  BID_INCREMENT,
  MAX_ROSTER,
  MIN_ROSTER,
  MEDAL_LABELS,
  basePriceFor,
  parseMedal,
  type Medal,
} from "./constants";
import { prisma } from "./prisma";
import { getLiveSeason } from "./seasons";
import { rebalanceTeamRoster } from "./players-admin";
import { notifySiteRefresh } from "./notify-site";
import { isDummyDiscordId } from "./dummy";

export const AUCTION_PLAYER_STATUS = {
  UNSOLD: "UNSOLD",
  ON_AUCTION: "ON_AUCTION",
  SOLD: "SOLD",
} as const;

type WebPlayer = {
  id: string;
  steamName: string;
  medal: string;
  rolesJson: string;
  basePrice: number;
};

type WebTeam = {
  id: string;
  name: string;
  purse: number;
  rosterCount: number;
};

type WebSale = {
  playerName: string;
  teamName: string | null;
  price: number | null;
  medal: string;
};

export type WebAuctionSession = {
  seasonId: string;
  status: "idle" | "running" | "paused";
  medal: Medal | null;
  queue: string[];
  currentPlayerId: string | null;
  currentBid: number;
  currentBidderTeamId: string | null;
  endsAtMs: number | null;
  awaitingDecision: boolean;
  event: "idle" | "lot" | "bid" | "sold" | "unsold" | "done";
  players: Record<string, WebPlayer>;
  teams: Record<string, WebTeam>;
  lastSale: WebSale | null;
};

export type WebAuctionView = {
  status: WebAuctionSession["status"];
  medal: string | null;
  medalLabel: string | null;
  secondsLeft: number;
  currentBid: number;
  currentPlayer: WebPlayer | null;
  highBidder: { id: string; name: string } | null;
  remainingInPool: number;
  awaitingDecision: boolean;
  event: WebAuctionSession["event"];
  lastSale: WebSale | null;
  teamBalances: { id: string; name: string; purse: number; rosterCount: number }[];
  seasonId: string | null;
};

function secondsLeft(endsAtMs: number | null) {
  if (!endsAtMs) return 0;
  return Math.max(0, Math.ceil((endsAtMs - Date.now()) / 1000));
}

function nowEndsAt() {
  return Date.now() + BID_CLOCK_SECONDS * 1000;
}

function playerFloor(player: WebPlayer) {
  return player.basePrice > 0 ? player.basePrice : basePriceFor(player.medal);
}

/** Reserve purse so team can still fill MIN_ROSTER at base prices after this buy. */
function purseAllowsBid(team: WebTeam, bid: number, player: WebPlayer) {
  if (team.purse < bid) return false;
  const afterRoster = team.rosterCount + 1;
  const stillNeeded = Math.max(0, MIN_ROSTER - afterRoster);
  if (stillNeeded === 0) return team.purse >= bid;
  const reserve = stillNeeded * playerFloor(player);
  return team.purse - bid >= reserve;
}

async function loadRow() {
  return prisma.auctionState.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

async function readSession(): Promise<WebAuctionSession | null> {
  const row = await loadRow();
  if (!row.sessionJson) return null;
  try {
    return JSON.parse(row.sessionJson) as WebAuctionSession;
  } catch {
    return null;
  }
}

async function writeSession(session: WebAuctionSession) {
  await prisma.auctionState.update({
    where: { id: "singleton" },
    data: {
      status: session.status,
      role: session.medal,
      currentPlayerId: session.currentPlayerId,
      currentLotId: session.currentPlayerId,
      currentBid: session.currentBid,
      currentBidderTeamId: session.currentBidderTeamId,
      endsAt: session.endsAtMs ? new Date(session.endsAtMs) : null,
      queueJson: JSON.stringify(session.queue),
      seasonId: session.seasonId,
      awaitingDecision: session.awaitingDecision,
      event: session.event,
      sessionJson: JSON.stringify(session),
      lastSaleJson: session.lastSale ? JSON.stringify(session.lastSale) : null,
    },
  });
  void notifySiteRefresh();
}

function viewFrom(session: WebAuctionSession | null): WebAuctionView {
  if (!session) {
    return {
      status: "idle",
      medal: null,
      medalLabel: null,
      secondsLeft: 0,
      currentBid: 0,
      currentPlayer: null,
      highBidder: null,
      remainingInPool: 0,
      awaitingDecision: false,
      event: "idle",
      lastSale: null,
      teamBalances: [],
      seasonId: null,
    };
  }
  const current = session.currentPlayerId
    ? session.players[session.currentPlayerId] ?? null
    : null;
  const bidder = session.currentBidderTeamId
    ? session.teams[session.currentBidderTeamId] ?? null
    : null;
  return {
    status: session.status,
    medal: session.medal,
    medalLabel: session.medal ? MEDAL_LABELS[session.medal] : null,
    secondsLeft: secondsLeft(session.endsAtMs),
    currentBid: session.currentBid,
    currentPlayer: current,
    highBidder: bidder ? { id: bidder.id, name: bidder.name } : null,
    remainingInPool: session.queue.length,
    awaitingDecision: session.awaitingDecision,
    event: session.event,
    lastSale: session.lastSale,
    teamBalances: Object.values(session.teams)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => ({
        id: t.id,
        name: t.name,
        purse: t.purse,
        rosterCount: t.rosterCount,
      })),
    seasonId: session.seasonId,
  };
}

function openLot(session: WebAuctionSession, playerId: string) {
  const player = session.players[playerId];
  session.currentPlayerId = playerId;
  session.currentBid = player ? playerFloor(player) : 0;
  session.currentBidderTeamId = null;
  session.endsAtMs = null;
  session.awaitingDecision = false;
  session.event = "lot";
}

export async function getWebAuctionView(): Promise<WebAuctionView> {
  const session = await readSession();
  return viewFrom(session);
}

export async function startWebAuction(rankInput: string) {
  const liveSeason = await getLiveSeason();
  if (!liveSeason) throw new Error("No live season. Activate a season first.");
  if (liveSeason.tournamentFormat === "TEAM_BASED") {
    throw new Error("This season is team-based — assign rosters instead of auction.");
  }

  const existing = await readSession();
  if (existing && (existing.status === "running" || existing.status === "paused")) {
    throw new Error("Auction already running. Pause or finish it first.");
  }

  const medal = parseMedal(rankInput);
  const seasonId = liveSeason.id;

  const [unsigned, teams] = await Promise.all([
    prisma.player.findMany({
      where: {
        teamId: null,
        auctionStatus: { not: AUCTION_PLAYER_STATUS.SOLD },
      },
      orderBy: { steamName: "asc" },
    }),
    prisma.team.findMany({
      where: { seasonId },
      include: { players: true },
    }),
  ]);

  const eligible = unsigned
    .filter((p) => !isDummyDiscordId(p.discordId))
    .filter((p) => p.medal.toLowerCase() === medal);

  if (eligible.length === 0) {
    throw new Error(`No unsigned players at **${MEDAL_LABELS[medal]}**.`);
  }

  const players: Record<string, WebPlayer> = {};
  for (const p of eligible) {
    players[p.id] = {
      id: p.id,
      steamName: p.steamName,
      medal: p.medal,
      rolesJson: p.rolesJson,
      basePrice: p.basePrice ?? basePriceFor(p.medal),
    };
  }

  const teamMap: Record<string, WebTeam> = {};
  for (const t of teams) {
    teamMap[t.id] = {
      id: t.id,
      name: t.name,
      purse: t.purse,
      rosterCount: t.players.length,
    };
  }

  const queue = eligible.map((p) => p.id);
  const first = queue.shift()!;
  const session: WebAuctionSession = {
    seasonId,
    status: "running",
    medal,
    queue,
    currentPlayerId: first,
    currentBid: 0,
    currentBidderTeamId: null,
    endsAtMs: null,
    awaitingDecision: false,
    event: "lot",
    players,
    teams: teamMap,
    lastSale: null,
  };
  openLot(session, first);

  await prisma.player.updateMany({
    where: { id: { in: eligible.map((p) => p.id) } },
    data: { auctionStatus: AUCTION_PLAYER_STATUS.UNSOLD },
  });
  await prisma.player.update({
    where: { id: first },
    data: { auctionStatus: AUCTION_PLAYER_STATUS.ON_AUCTION },
  });
  await prisma.season.update({
    where: { id: seasonId },
    data: { phase: "AUCTION_ACTIVE" },
  });

  await writeSession(session);
  return viewFrom(session);
}

export async function introduceNextWebPlayer() {
  const session = await readSession();
  if (!session || session.status === "idle") {
    throw new Error("No auction running.");
  }
  if (session.currentPlayerId && !session.awaitingDecision && session.endsAtMs) {
    throw new Error("Finish the current lot (Sold / Pass) before introducing another.");
  }
  const next = session.queue.shift();
  if (!next) {
    session.status = "idle";
    session.event = "done";
    session.currentPlayerId = null;
    await writeSession(session);
    return viewFrom(session);
  }
  if (session.currentPlayerId) {
    await prisma.player.update({
      where: { id: session.currentPlayerId },
      data: { auctionStatus: AUCTION_PLAYER_STATUS.UNSOLD },
    }).catch(() => undefined);
  }
  openLot(session, next);
  session.status = "running";
  await prisma.player.update({
    where: { id: next },
    data: { auctionStatus: AUCTION_PLAYER_STATUS.ON_AUCTION },
  });
  await writeSession(session);
  return viewFrom(session);
}

export async function startWebTimer() {
  const session = await readSession();
  if (!session || session.status !== "running") {
    throw new Error("Auction is not running.");
  }
  if (!session.currentPlayerId) throw new Error("No player on the hammer.");
  session.endsAtMs = nowEndsAt();
  session.awaitingDecision = false;
  session.event = "bid";
  await writeSession(session);
  return viewFrom(session);
}

export async function resetWebTimer() {
  return startWebTimer();
}

export async function pauseWebAuction() {
  const session = await readSession();
  if (!session || session.status !== "running") {
    throw new Error("No running auction to pause.");
  }
  session.status = "paused";
  session.event = "bid";
  await writeSession(session);
  return viewFrom(session);
}

export async function resumeWebAuction() {
  const session = await readSession();
  if (!session || session.status !== "paused") {
    throw new Error("Auction is not paused.");
  }
  session.status = "running";
  if (!session.awaitingDecision) session.endsAtMs = nowEndsAt();
  session.event = "bid";
  await writeSession(session);
  return viewFrom(session);
}

export async function placeWebBid(input: {
  teamId: string;
  bump?: number;
  amount?: number;
}) {
  const session = await readSession();
  if (!session) throw new Error("No auction running.");
  if (session.status !== "running") throw new Error("Auction is paused.");
  if (!session.currentPlayerId) throw new Error("No player on the hammer.");
  if (session.awaitingDecision) {
    throw new Error("Clock ended. Admin must Sold or Pass.");
  }
  if (session.endsAtMs && session.endsAtMs <= Date.now()) {
    session.awaitingDecision = true;
    await writeSession(session);
    throw new Error("Clock ended. Admin must Sold or Pass.");
  }

  const team = session.teams[input.teamId];
  if (!team) throw new Error("Team not found in this auction.");
  const player = session.players[session.currentPlayerId];
  if (!player) throw new Error("Current player missing.");

  if (team.rosterCount >= MAX_ROSTER) {
    throw new Error(`**${team.name}** is full (${MAX_ROSTER}/${MAX_ROSTER}).`);
  }

  let next: number;
  if (input.bump) {
    next = session.currentBidderTeamId
      ? session.currentBid + input.bump
      : session.currentBid;
  } else if (input.amount != null) {
    next = input.amount;
  } else {
    next = session.currentBidderTeamId
      ? session.currentBid + BID_INCREMENT
      : session.currentBid;
  }

  if (!session.currentBidderTeamId) {
    if (next < session.currentBid) {
      throw new Error(`Opening bid must be at least ${session.currentBid}.`);
    }
  } else if (next < session.currentBid + BID_INCREMENT) {
    throw new Error(`Bid must be at least ${session.currentBid + BID_INCREMENT}.`);
  }

  if (team.id === session.currentBidderTeamId) {
    throw new Error("You are already the high bidder.");
  }
  if (!purseAllowsBid(team, next, player)) {
    throw new Error(
      `**${team.name}** cannot bid ${next}. Keep enough purse to fill ${MIN_ROSTER} starters (purse ${team.purse}).`,
    );
  }

  session.currentBid = next;
  session.currentBidderTeamId = team.id;
  session.endsAtMs = nowEndsAt();
  session.event = "bid";
  await writeSession(session);
  return viewFrom(session);
}

async function settle(kind: "sold" | "unsold") {
  const session = await readSession();
  if (!session || !session.currentPlayerId) {
    throw new Error("No lot to settle.");
  }
  const playerId = session.currentPlayerId;
  const player = session.players[playerId];
  const team = session.currentBidderTeamId
    ? session.teams[session.currentBidderTeamId]
    : null;

  if (kind === "sold" && !team) {
    throw new Error("No high bidder. Use Pass / Unsold.");
  }

  session.lastSale = {
    playerName: player?.steamName ?? "Player",
    teamName: kind === "sold" ? team?.name ?? null : null,
    price: kind === "sold" ? session.currentBid : null,
    medal: player?.medal ?? session.medal ?? "",
  };

  if (kind === "sold" && team) {
    team.purse -= session.currentBid;
    team.rosterCount += 1;
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
          auctionStatus: AUCTION_PLAYER_STATUS.SOLD,
        },
      }),
      prisma.auctionLot.create({
        data: {
          seasonId: session.seasonId,
          role: session.medal ?? player?.medal ?? "uncalibrated",
          playerId,
          teamId: team.id,
          soldPrice: session.currentBid,
          status: "sold",
        },
      }),
    ]);
    await rebalanceTeamRoster(team.id);
    session.event = "sold";
  } else {
    await prisma.player.update({
      where: { id: playerId },
      data: { auctionStatus: AUCTION_PLAYER_STATUS.UNSOLD },
    });
    await prisma.auctionLot.create({
      data: {
        seasonId: session.seasonId,
        role: session.medal ?? player?.medal ?? "uncalibrated",
        playerId,
        status: "unsold",
      },
    });
    session.event = "unsold";
  }

  const nextId = session.queue.shift();
  if (!nextId) {
    session.status = "idle";
    session.currentPlayerId = null;
    session.currentBidderTeamId = null;
    session.endsAtMs = null;
    session.awaitingDecision = false;
    session.event = "done";
    await prisma.season.update({
      where: { id: session.seasonId },
      data: { phase: "IN_PROGRESS" },
    }).catch(() => undefined);
  } else {
    openLot(session, nextId);
    await prisma.player.update({
      where: { id: nextId },
      data: { auctionStatus: AUCTION_PLAYER_STATUS.ON_AUCTION },
    });
  }

  await writeSession(session);
  return viewFrom(session);
}

export async function confirmWebSold() {
  return settle("sold");
}

export async function passWebUnsold() {
  return settle("unsold");
}

export async function tickWebAuction() {
  const session = await readSession();
  if (!session) return { changed: false, view: viewFrom(null) };
  if (session.status !== "running" || !session.endsAtMs || session.awaitingDecision) {
    return { changed: false, view: viewFrom(session) };
  }
  if (session.endsAtMs > Date.now() + 250) {
    return { changed: false, view: viewFrom(session) };
  }
  session.awaitingDecision = true;
  session.event = "bid";
  await writeSession(session);
  return { changed: true, view: viewFrom(session) };
}

export function generateCaptainPasscode() {
  return randomBytes(4).toString("hex");
}

export function generateCaptainToken() {
  return randomBytes(24).toString("hex");
}
