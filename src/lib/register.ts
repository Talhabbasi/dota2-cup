import { prisma } from "./prisma";
import { getLiveSeason, syncSeasonPlayer, syncSeasonPlayers } from "./seasons";
import { medalBlockedByMaxRank } from "./cup-features";
import { parseMedalForGame } from "./constants";
import { isPubgSeason } from "./games";
import { parsePlayWindow } from "./play-window";
import { assertCanJoinLiveSeason } from "./registration-status";
import { parseRegistrationRoles, stringifyRoles } from "./roles";
import { hasOpenDotaProfile, resolveSteamProfile } from "./steam";

async function playersForDiscord(discordId: string) {
  return prisma.player.findMany({
    where: {
      OR: [
        { discordId },
        { discordId: { startsWith: `${discordId}:` } },
      ],
    },
  });
}

async function liveSeasonMembership(playerId: string, seasonId: string | undefined) {
  if (!seasonId) return null;
  return prisma.seasonPlayer.findUnique({
    where: {
      seasonId_playerId: { seasonId, playerId },
    },
    select: { teamId: true },
  });
}

/** Public register: one Discord per live season. Admins may still update via bypassCapacity. */
function assertNotAlreadyRegistered(input: {
  enrolled: boolean;
  bypassCapacity?: boolean;
}) {
  if (input.enrolled && !input.bypassCapacity) {
    throw new Error(
      "Already registered. Ask an admin if you need to change rank or roles.",
    );
  }
}

function cleanPubgName(raw: string | null | undefined) {
  const name = raw?.trim().replace(/\s+/g, " ") ?? "";
  if (name.length < 2 || name.length > 24) {
    throw new Error("PUBG name must be 2–24 characters.");
  }
  return name;
}

export async function registerPlayer(input: {
  discordId: string;
  discordName: string;
  steam?: string | null;
  pubgName?: string | null;
  medal?: string | null;
  role?: string | string[] | null;
  roles?: string | string[] | null;
  playWindow?: string | null;
  /** Discord CDN avatar URL from the registering user. */
  discordAvatarUrl?: string | null;
  /** Admin late adds may enroll past the public team×roster cap. */
  bypassCapacity?: boolean;
}) {
  const liveSeason = await getLiveSeason();
  const pubg = isPubgSeason(liveSeason);
  const playWindow = parsePlayWindow(input.playWindow || "both");
  const capacity = { bypassCapacity: input.bypassCapacity };
  const discordAvatarUrl = input.discordAvatarUrl?.trim() || undefined;

  if (pubg) {
    const pubgName = cleanPubgName(input.pubgName);
    const steam = input.steam?.trim() ?? "";
    if (!steam) {
      throw new Error(
        "Steam profile URL is required. One Discord account links to one Steam account.",
      );
    }
    const medal = parseMedalForGame(input.medal ?? "", "PUBG");
    const profile = await resolveSteamProfile(steam);
    const [discordPlayers, existingBySteam] = await Promise.all([
      playersForDiscord(input.discordId),
      prisma.player.findUnique({ where: { steam32: profile.steam32 } }),
    ]);
    const existingByDiscord = discordPlayers[0] ?? null;

    if (
      existingBySteam &&
      existingBySteam.discordId !== input.discordId &&
      !existingBySteam.discordId.startsWith(`${input.discordId}:`)
    ) {
      throw new Error(
        `That Steam account is already linked to **${existingBySteam.discordName}**. One Steam account can only belong to one Discord.`,
      );
    }

    if (
      existingByDiscord?.steam32 != null &&
      existingByDiscord.steam32 !== profile.steam32
    ) {
      throw new Error(
        "This Discord is already linked to a different Steam account. One Discord ↔ one Steam.",
      );
    }

    const current = existingBySteam ?? existingByDiscord;
    const seasonMembership = current
      ? await liveSeasonMembership(current.id, liveSeason?.id)
      : null;
    const enrolled = Boolean(seasonMembership);
    const onTeam = Boolean(seasonMembership?.teamId);

    if (current) {
      assertNotAlreadyRegistered({
        enrolled,
        bypassCapacity: input.bypassCapacity,
      });
      await assertCanJoinLiveSeason({
        playerId: current.id,
        ...capacity,
      });
      const player = await prisma.player.update({
        where: { id: current.id },
        data: {
          discordId: input.discordId,
          discordName: input.discordName,
          pubgName: onTeam ? current.pubgName ?? pubgName : pubgName,
          steam32: profile.steam32,
          steamName: onTeam ? current.steamName : pubgName,
          medal: onTeam ? current.medal : medal,
          basePrice: onTeam ? current.basePrice : null,
          playWindow,
          ...(discordAvatarUrl ? { discordAvatarUrl } : {}),
        },
      });
      await syncSeasonPlayer(player.id);
      return {
        player,
        created: false,
        profileUrl: profile.profileUrl,
        openDotaLinked: false,
      };
    }

    await assertCanJoinLiveSeason(capacity);
    const player = await prisma.player.create({
      data: {
        discordId: input.discordId,
        discordName: input.discordName,
        pubgName,
        steam32: profile.steam32,
        steamName: pubgName,
        medal,
        rolesJson: "[]",
        playWindow,
        ...(discordAvatarUrl ? { discordAvatarUrl } : {}),
      },
    });
    await syncSeasonPlayer(player.id);
    return {
      player,
      created: true,
      profileUrl: profile.profileUrl,
      openDotaLinked: false,
    };
  }

  const steam = input.steam?.trim() ?? "";
  if (!steam) throw new Error("Steam profile URL is required.");
  const medal = parseMedalForGame(input.medal ?? "", "DOTA");
  const roles = parseRegistrationRoles(input.roles ?? input.role);

  const blocked = await medalBlockedByMaxRank(medal);
  if (blocked) throw new Error(blocked);

  const profile = await resolveSteamProfile(steam);
  const openDotaLinked = await hasOpenDotaProfile(profile.steam32);

  const [discordPlayers, existingBySteam] = await Promise.all([
    playersForDiscord(input.discordId),
    prisma.player.findUnique({ where: { steam32: profile.steam32 } }),
  ]);
  const existingByDiscord = discordPlayers[0] ?? null;

  if (
    existingBySteam &&
    existingBySteam.discordId !== input.discordId &&
    !existingBySteam.discordId.startsWith(`${input.discordId}:`)
  ) {
    throw new Error(
      `That Steam account is already linked to **${existingBySteam.discordName}**. One Steam account can only belong to one Discord.`,
    );
  }

  if (
    existingByDiscord &&
    existingByDiscord.steam32 !== profile.steam32
  ) {
    throw new Error(
      "This Discord is already linked to a different Steam account. One Discord ↔ one Steam. Ask an admin for `/player delete` if you need a reset.",
    );
  }

  if (existingBySteam || existingByDiscord) {
    const current = existingBySteam ?? existingByDiscord!;
    const seasonMembership = await liveSeasonMembership(
      current.id,
      liveSeason?.id,
    );
    const enrolled = Boolean(seasonMembership);
    const onTeam = Boolean(seasonMembership?.teamId);
    assertNotAlreadyRegistered({
      enrolled,
      bypassCapacity: input.bypassCapacity,
    });
    await assertCanJoinLiveSeason({
      playerId: current.id,
      ...capacity,
    });
    const player = await prisma.player.update({
      where: { id: current.id },
      data: {
        discordId: input.discordId,
        discordName: input.discordName,
        steamName: onTeam ? current.steamName : profile.steamName,
        medal: onTeam ? current.medal : medal,
        rolesJson: onTeam ? current.rolesJson : stringifyRoles(roles),
        playWindow,
        ...(discordAvatarUrl ? { discordAvatarUrl } : {}),
      },
    });
    await syncSeasonPlayer(player.id);
    return {
      player,
      created: false,
      profileUrl: profile.profileUrl,
      openDotaLinked,
    };
  }

  await assertCanJoinLiveSeason(capacity);
  const player = await prisma.player.create({
    data: {
      discordId: input.discordId,
      discordName: input.discordName,
      steam32: profile.steam32,
      steamName: profile.steamName,
      medal,
      rolesJson: stringifyRoles(roles),
      playWindow,
      ...(discordAvatarUrl ? { discordAvatarUrl } : {}),
    },
  });
  await syncSeasonPlayer(player.id);
  return {
    player,
    created: true,
    profileUrl: profile.profileUrl,
    openDotaLinked,
  };
}

export async function setPlayerPlayWindow(discordId: string, window: string) {
  const playWindow = parsePlayWindow(window);
  const players = await playersForDiscord(discordId);
  if (players.length === 0) {
    throw new Error("You are not registered. Use `/register` first.");
  }

  await prisma.player.updateMany({
    where: { id: { in: players.map((p) => p.id) } },
    data: { playWindow },
  });
  await syncSeasonPlayers(players.map((p) => p.id));

  return { playWindow, steamName: players[0].steamName };
}
