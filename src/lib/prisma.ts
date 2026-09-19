import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Neon pooler + long-running bot: keep Prisma's pool small so idle closes recover. */
function withRuntimePoolParams(url: string) {
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.includes("-pooler") &&
      !parsed.searchParams.has("pgbouncer")
    ) {
      parsed.searchParams.set("pgbouncer", "true");
    }
    // Do not cap the pool on Vercel: `next build` prerenders pages with
    // parallel queries, and a limit of 1 stalls the Prisma engine.
    if (!process.env.VERCEL && !parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "5");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "20");
    }
    if (!parsed.searchParams.has("connect_timeout")) {
      parsed.searchParams.set("connect_timeout", "10");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

async function resetConnection(client: PrismaClient) {
  await client.$disconnect().catch(() => undefined);
  await client.$connect();
}

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  return new PrismaClient(
    url ? { datasources: { db: { url: withRuntimePoolParams(url) } } } : undefined,
  );
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

export async function keepPrismaAlive() {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    await resetConnection(prisma);
  }
}
