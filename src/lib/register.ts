import { prisma } from "./prisma";
import { parseMedal } from "./constants";
import { parsePlayWindow } from "./play-window";
import { parseRegistrationRole, stringifyRoles } from "./roles";
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

export async function registerPlayer(input: {
  discordId: string;
  discordName: string;
  steam: string;
  medal: string;
  role: string;
  playWindow: string;
}) {
  const medal = parseMedal(input.medal);
  const roles = parseRegistrationRole(input.role);
  const playWindow = parsePlayWindow(input.playWindow);

  const profile = await resolveSteamProfile(input.steam);
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
    const locked = Boolean(current.teamId);
    const player = await prisma.player.update({
      where: { id: current.id },
      data: {
        discordId: input.discordId,
        discordName: input.discordName,
        steamName: profile.steamName,
        medal: locked ? current.medal : medal,
        rolesJson: locked ? current.rolesJson : stringifyRoles(roles),
        playWindow,
      },
    });
    return {
      player,
      created: false,
      profileUrl: profile.profileUrl,
      openDotaLinked,
    };
  }

  const player = await prisma.player.create({
    data: {
      discordId: input.discordId,
      discordName: input.discordName,
      steam32: profile.steam32,
      steamName: profile.steamName,
      medal,
      rolesJson: stringifyRoles(roles),
      playWindow,
    },
  });
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

  return { playWindow, steamName: players[0].steamName };
}
