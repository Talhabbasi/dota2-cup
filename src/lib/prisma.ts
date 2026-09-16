import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  return new PrismaClient();
}

function prismaClientIsCurrent(client: PrismaClient) {
  const tables = client as PrismaClient & {
    scheduledFixture?: unknown;
    season?: unknown;
    seasonPlayer?: unknown;
    postedRelease?: unknown;
  };
  return (
    typeof tables.scheduledFixture !== "undefined" &&
    typeof tables.season !== "undefined" &&
    typeof tables.seasonPlayer !== "undefined" &&
    typeof tables.postedRelease !== "undefined"
  );
}

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && prismaClientIsCurrent(cached)) {
    return cached;
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

export const prisma = getPrismaClient();
