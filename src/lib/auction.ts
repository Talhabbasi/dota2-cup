import {
  BID_CLOCK_SECONDS,
  BID_INCREMENT,
  MAX_ROSTER,
  ROLE_LABELS,
  basePriceFor,
  parseRole,
  type Role,
} from "./constants";
import { prisma } from "./prisma";
import { isEligibleForLot, parseRolesJson, rosterRoleForTeamJoin } from "./roles";

let chain: Promise<unknown> = Promise.resolve();

function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function ensureAuctionState() {
  return prisma.auctionState.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

function secondsLeft(endsAt: Date | null): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 1000));
}

async function eligibleQueue(role: Role): Promise<string[]> {
  const unsigned = await prisma.player.findMany({
    where: { teamId: null },
    orderBy: { steamName: "asc" },
  });
  return unsigned
    .filter((p) => isEligibleForLot(parseRolesJson(p.rolesJson), role))
    .sort((a, b) => basePriceFor(b.medal) - basePriceFor(a.medal))
    .map((p) => p.id);
}

async function openLot(playerId: string, role: Role) {
  const player = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
  });
  const base = basePriceFor(player.medal);
  const lot = await prisma.auctionLot.create({
    data: {
      role,
      playerId,
      status: "live",
    },
  });
  const endsAt = new Date(Date.now() + BID_CLOCK_SECONDS * 1000);
  await prisma.auctionState.update({
    where: { id: "singleton" },
    data: {
      status: "running",
      role,
      currentLotId: lot.id,
      currentPlayerId: player.id,
      currentBid: base,
      currentBidderTeamId: null,
      endsAt,
    },
  });
  return lot;
}

async function advanceQueue() {
  const state = await ensureAuctionState();
  if (!state.role) {
    await prisma.auctionState.update({
      where: { id: "singleton" },
      data: {
        status: "idle",
        currentLotId: null,
        currentPlayerId: null,
        currentBidderTeamId: null,
        endsAt: null,
        queueJson: "[]",
      },
    });
    return { done: true as const };
  }

  const queue = JSON.parse(state.queueJson) as string[];
  const nextId = queue.shift();
  if (!nextId) {
    await prisma.auctionState.update({
      where: { id: "singleton" },
      data: {
        status: "idle",
        role: null,
        currentLotId: null,
        currentPlayerId: null,
        currentBidderTeamId: null,
        endsAt: null,
        queueJson: "[]",
      },
    });
    return { done: true as const, role: state.role };
  }

  await prisma.auctionState.update({
    where: { id: "singleton" },
    data: { queueJson: JSON.stringify(queue) },
  });
  await openLot(nextId, state.role as Role);
  return { done: false as const };
}

async function settleCurrent(kind: "sold" | "unsold") {
  const state = await ensureAuctionState();
  if (!state.currentLotId || !state.currentPlayerId) {
    return advanceQueue();
  }

  if (kind === "sold" && state.currentBidderTeamId) {
    const team = await prisma.team.findUniqueOrThrow({
      where: { id: state.currentBidderTeamId },
      include: { players: true },
    });
    if (team.purse < state.currentBid) {
      throw new Error("Winning captain no longer has enough points.");
    }

    await prisma.team.update({
      where: { id: team.id },
      data: { purse: team.purse - state.currentBid },
    });
    const rosterRole = rosterRoleForTeamJoin(team.players);
    await prisma.player.update({
      where: { id: state.currentPlayerId },
      data: {
        teamId: team.id,
        rosterRole,
      },
    });
    await prisma.auctionLot.update({
      where: { id: state.currentLotId },
      data: {
        status: "sold",
        teamId: team.id,
        soldPrice: state.currentBid,
      },
    });
  } else {
    await prisma.auctionLot.update({
      where: { id: state.currentLotId },
      data: { status: "unsold" },
    });
  }

  await prisma.auctionState.update({
    where: { id: "singleton" },
    data: { lastLotId: state.currentLotId },
  });

  return advanceQueue();
}

export async function startAuction(roleInput: string) {
  return locked(async () => {
    const role = parseRole(roleInput);
    const state = await ensureAuctionState();
    if (state.status === "running") {
      throw new Error(
        `Auction already running for ${ROLE_LABELS[state.role as Role] ?? state.role}. Pause or finish it first.`,
      );
    }

    const queue = await eligibleQueue(role);
    if (queue.length === 0) {
      throw new Error(
        `No unsigned players listed for ${ROLE_LABELS[role]} (or flex).`,
      );
    }

    const first = queue.shift()!;
    await prisma.auctionState.update({
      where: { id: "singleton" },
      data: {
        status: "running",
        role,
        queueJson: JSON.stringify(queue),
        lastLotId: null,
      },
    });
    await openLot(first, role);
    return getAuctionView();
  });
}

export async function pauseAuction() {
  return locked(async () => {
    const state = await ensureAuctionState();
    if (state.status !== "running") {
      throw new Error("No live auction to pause.");
    }
    await prisma.auctionState.update({
      where: { id: "singleton" },
      data: { status: "paused" },
    });
    return getAuctionView();
  });
}

export async function resumeAuction() {
  return locked(async () => {
    const state = await ensureAuctionState();
    if (state.status !== "paused") {
      throw new Error("Auction is not paused.");
    }
    const endsAt = new Date(Date.now() + BID_CLOCK_SECONDS * 1000);
    await prisma.auctionState.update({
      where: { id: "singleton" },
      data: { status: "running", endsAt },
    });
    return getAuctionView();
  });
}

export async function skipLot() {
  return locked(async () => {
    const state = await ensureAuctionState();
    if (state.status === "idle" || !state.currentPlayerId) {
      throw new Error("Nothing on the block.");
    }
    await settleCurrent("unsold");
    return getAuctionView();
  });
}

export async function undoLastSale() {
  return locked(async () => {
    const state = await ensureAuctionState();
    if (!state.lastLotId) {
      throw new Error("Nothing to undo.");
    }
    const lot = await prisma.auctionLot.findUnique({
      where: { id: state.lastLotId },
      include: { player: true, team: true },
    });
    if (!lot || lot.status !== "sold" || !lot.teamId || !lot.soldPrice) {
      throw new Error("Last lot was not a sale.");
    }

    await prisma.player.update({
      where: { id: lot.playerId },
      data: { teamId: null, rosterRole: null },
    });
    await prisma.team.update({
      where: { id: lot.teamId },
      data: { purse: { increment: lot.soldPrice } },
    });
    await prisma.auctionLot.update({
      where: { id: lot.id },
      data: { status: "undone", teamId: null },
    });

    const queue = JSON.parse(state.queueJson) as string[];
    if (state.currentPlayerId) {
      queue.unshift(state.currentPlayerId);
    }

    await prisma.auctionState.update({
      where: { id: "singleton" },
      data: {
        status: "running",
        role: lot.role,
        queueJson: JSON.stringify(queue),
        lastLotId: null,
      },
    });
    await openLot(lot.playerId, lot.role as Role);
    return getAuctionView();
  });
}

export async function placeBid(input: {
  discordId: string;
  amount?: number;
  bump?: number;
}) {
  return locked(async () => {
    const state = await ensureAuctionState();
    if (state.status !== "running" || !state.currentLotId || !state.currentPlayerId) {
      throw new Error("No player is on the block.");
    }
    if (state.endsAt && state.endsAt.getTime() <= Date.now()) {
      throw new Error("Clock already expired. Wait for the next lot.");
    }

    const captain = await prisma.player.findUnique({
      where: { discordId: input.discordId },
      include: { team: { include: { players: true } } },
    });
    if (!captain?.isCaptain || !captain.team) {
      throw new Error("Only captains can bid.");
    }
    const team = captain.team;
    const role = state.role ?? "";

    if (team.players.length >= MAX_ROSTER) {
      throw new Error(`${team.name} already has ${MAX_ROSTER} players.`);
    }

    const base = state.currentBid;
    let next: number;
    if (input.bump) {
      next = state.currentBidderTeamId
        ? state.currentBid + input.bump
        : state.currentBid;
      if (state.currentBidderTeamId && input.bump < BID_INCREMENT) {
        throw new Error(`Minimum increment is ${BID_INCREMENT}.`);
      }
    } else if (input.amount != null) {
      next = input.amount;
    } else {
      next = state.currentBidderTeamId
        ? state.currentBid + BID_INCREMENT
        : state.currentBid;
    }

    if (!state.currentBidderTeamId) {
      if (next < base) {
        throw new Error(`Opening bid must be at least ${base}.`);
      }
    } else {
      if (next < state.currentBid + BID_INCREMENT) {
        throw new Error(
          `Bid must be at least ${state.currentBid + BID_INCREMENT}.`,
        );
      }
    }

    if (team.id === state.currentBidderTeamId) {
      throw new Error("You are already the high bidder.");
    }
    if (team.purse < next) {
      throw new Error(
        `${team.name} only has ${team.purse} points left.`,
      );
    }

    await prisma.bid.create({
      data: {
        lotId: state.currentLotId,
        playerId: captain.id,
        teamId: team.id,
        amount: next,
      },
    });

    const endsAt = new Date(Date.now() + BID_CLOCK_SECONDS * 1000);
    await prisma.auctionState.update({
      where: { id: "singleton" },
      data: {
        currentBid: next,
        currentBidderTeamId: team.id,
        endsAt,
      },
    });

    return getAuctionView();
  });
}

export async function tickAuction() {
  return locked(async () => {
    const state = await ensureAuctionState();
    if (state.status !== "running" || !state.endsAt) {
      return { changed: false, view: await getAuctionView() };
    }
    if (state.endsAt.getTime() > Date.now()) {
      return { changed: false, view: await getAuctionView() };
    }
    const kind = state.currentBidderTeamId ? "sold" : "unsold";
    await settleCurrent(kind);
    return { changed: true, kind, view: await getAuctionView() };
  });
}

export async function saveAuctionMessage(channelId: string, messageId: string) {
  await prisma.auctionState.update({
    where: { id: "singleton" },
    data: { channelId, messageId },
  });
}

export async function getAuctionView() {
  const state = await ensureAuctionState();
  const player = state.currentPlayerId
    ? await prisma.player.findUnique({ where: { id: state.currentPlayerId } })
    : null;
  const bidder = state.currentBidderTeamId
    ? await prisma.team.findUnique({ where: { id: state.currentBidderTeamId } })
    : null;
  const queue = JSON.parse(state.queueJson) as string[];
  const recentLots = await prisma.auctionLot.findMany({
    where: { status: { in: ["sold", "unsold"] } },
    include: { player: true, team: true },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const liveBids = state.currentLotId
    ? await prisma.bid.findMany({
        where: { lotId: state.currentLotId },
        include: { team: true, player: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];
  const teams = await prisma.team.findMany({
    include: { players: true },
    orderBy: { name: "asc" },
  });
  const pool = state.role
    ? await prisma.player.findMany({
        where: { teamId: null },
      })
    : [];
  const role = (state.role as Role | null) ?? null;
  const poolForRole = role
    ? pool.filter((p) => isEligibleForLot(parseRolesJson(p.rolesJson), role))
    : [];

  return {
    status: state.status,
    role,
    secondsLeft: secondsLeft(state.endsAt),
    endsAt: state.endsAt,
    currentBid: state.currentBid,
    currentPlayer: player,
    highBidder: bidder,
    remainingInRole: queue.length,
    poolSize: poolForRole.length,
    liveBids,
    recentLots,
    teams,
    channelId: state.channelId,
    messageId: state.messageId,
  };
}
