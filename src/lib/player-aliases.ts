import { prisma } from "./prisma";

export function normalizeAlias(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

export async function listAliasesForPlayer(playerId: string) {
  return prisma.playerAlias.findMany({
    where: { playerId },
    orderBy: { alias: "asc" },
  });
}

export async function addPlayerAlias(input: {
  discordId?: string;
  playerId?: string;
  alias: string;
}) {
  const raw = input.alias.trim();
  if (!raw) throw new Error("Alias cannot be empty.");
  const alias = normalizeAlias(raw);
  if (alias.length < 2) {
    throw new Error("Alias is too short after normalizing.");
  }

  const player = input.playerId
    ? await prisma.player.findUnique({ where: { id: input.playerId } })
    : input.discordId
      ? await prisma.player.findFirst({
          where: {
            OR: [
              { discordId: input.discordId },
              { discordId: { startsWith: `${input.discordId}:` } },
            ],
          },
        })
      : null;
  if (!player) {
    throw new Error("That player is not registered.");
  }

  const clash = await prisma.playerAlias.findUnique({ where: { alias } });
  if (clash && clash.playerId !== player.id) {
    throw new Error(`Alias **${raw}** already belongs to another player.`);
  }
  if (clash) {
    return { player, alias: clash, created: false as const };
  }

  const row = await prisma.playerAlias.create({
    data: { playerId: player.id, alias },
  });
  return { player, alias: row, created: true as const };
}

export async function removePlayerAlias(input: {
  discordId?: string;
  playerId?: string;
  alias: string;
}) {
  const alias = normalizeAlias(input.alias.trim());
  if (!alias) throw new Error("Alias cannot be empty.");

  const player = input.playerId
    ? await prisma.player.findUnique({ where: { id: input.playerId } })
    : input.discordId
      ? await prisma.player.findFirst({
          where: {
            OR: [
              { discordId: input.discordId },
              { discordId: { startsWith: `${input.discordId}:` } },
            ],
          },
        })
      : null;
  if (!player) {
    throw new Error("That player is not registered.");
  }

  const existing = await prisma.playerAlias.findFirst({
    where: { playerId: player.id, alias },
  });
  if (!existing) {
    throw new Error(`No alias **${input.alias.trim()}** on that player.`);
  }
  await prisma.playerAlias.delete({ where: { id: existing.id } });
  return { player, alias: existing };
}

/** Seed known OCR misreads once. Safe to call repeatedly. */
export async function seedDefaultPlayerAliases() {
  const defaults: Record<string, string[]> = {
    lordtheepa: [
      "loradtheeka",
      "lordtheeka",
      "theekralord",
      "theekra",
      "lordtheekra",
    ],
    theekralord: ["loradtheeka", "lordtheepa", "theekra", "lordtheekra"],
    ashh: ["ash", "mohsin", "ashhmm"],
    chessman: ["spoderman"],
    fearless: ["lundplayer"],
    hades7: ["barwa", "hades"],
    stoicswapcmds: ["stoic"],
  };

  const players = await prisma.player.findMany({
    select: { id: true, steamName: true },
  });
  const byNorm = new Map(
    players.map((p) => [normalizeAlias(p.steamName), p.id] as const),
  );

  let created = 0;
  for (const [steamNorm, aliases] of Object.entries(defaults)) {
    const playerId = byNorm.get(steamNorm);
    if (!playerId) continue;
    for (const raw of aliases) {
      const alias = normalizeAlias(raw);
      if (!alias) continue;
      try {
        await prisma.playerAlias.create({ data: { playerId, alias } });
        created += 1;
      } catch {
        /* unique clash — already seeded or owned */
      }
    }
  }
  return created;
}
