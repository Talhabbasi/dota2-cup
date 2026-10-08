import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type AuctionDb = Prisma.TransactionClient;

export class AuctionError extends Error {
  constructor(message: string, public status = 409) {
    super(message);
    this.name = "AuctionError";
  }
}

/** Transaction-scoped lock: shared by website, bot, and organizer mutations. */
export async function withAuctionLock<T>(work: (db: AuctionDb) => Promise<T>) {
  return prisma.$transaction(async (db) => {
    await lockAuction(db);
    return work(db);
  }, { maxWait: 5000, timeout: 15000 });
}

export async function requireAuctionSeason(db: AuctionDb) {
  const season = await db.season.findFirst({ where: { isActive: true } });
  if (!season || season.status === "archived") {
    throw new AuctionError("Activate a season first.");
  }
  return season;
}

export async function requireAuctionInactive(db: AuctionDb) {
  const row = await db.auctionState.findUnique({ where: { id: "singleton" } });
  if (row && row.status !== "idle") {
    throw new AuctionError("Finish the auction pool before changing teams, players, or seasons.");
  }
}

export async function lockAuction(db: AuctionDb) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(628104, 1)`;
}
