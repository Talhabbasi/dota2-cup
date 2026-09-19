import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const TRANSIENT_PRISMA_CODES = new Set([
  "P1001",
  "P1002",
  "P1008",
  "P1011",
  "P1017",
  "P2024",
]);

function isTransientPrismaError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  if (TRANSIENT_PRISMA_CODES.has(code)) return true;
  const message = error instanceof Error ? error.message : String(error);
  return (
    /server has closed the connection/i.test(message) ||
    /timed out fetching a new connection/i.test(message) ||
    /can't reach database server/i.test(message)
  );
}

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
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set(
        "connection_limit",
        process.env.VERCEL ? "1" : "5",
      );
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
  const base = new PrismaClient(
    url ? { datasources: { db: { url: withRuntimePoolParams(url) } } } : undefined,
  );
  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (error) {
          if (!isTransientPrismaError(error)) throw error;
          await resetConnection(base);
          return query(args);
        }
      },
    },
  }) as unknown as PrismaClient;
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
