import { prisma } from "./prisma";
import { parseMedal } from "./constants";
import { hasOpenDotaProfile, resolveSteamProfile } from "./steam";
import { parseRegistrationRole, stringifyRoles } from "./roles";

function allowMultiRegister() {
  return process.env.ALLOW_MULTI_REGISTER === "true";
}

export async function registerPlayer(input: {
  discordId: string;
  discordName: string;
  steam: string;
  medal: string;
  role: string;
}) {
  const medal = parseMedal(input.medal);
  const roles = parseRegistrationRole(input.role);

  const profile = await resolveSteamProfile(input.steam);
  const openDotaLinked = await hasOpenDotaProfile(profile.steam32);

  const existingByDiscord = await prisma.player.findUnique({
    where: { discordId: input.discordId },
  });
  const existingBySteam = await prisma.player.findUnique({
    where: { steam32: profile.steam32 },
  });
  const ownsSteam =
    existingBySteam &&
    (existingBySteam.discordId === input.discordId ||
      existingBySteam.discordId.startsWith(`${input.discordId}:`));

  if (existingBySteam && !ownsSteam && !allowMultiRegister()) {
    throw new Error(
      `That Steam account is already linked to **${existingBySteam.discordName}**. Each Steam account can only register once.`,
    );
  }

  if (existingBySteam && !ownsSteam && allowMultiRegister()) {
    throw new Error(
      `That Steam account is already registered as **${existingBySteam.discordName}**. Use a different Steam profile, or \`/player dummy\` for test players.`,
    );
  }

  if (ownsSteam && existingBySteam) {
    const locked = Boolean(existingBySteam.teamId);
    const player = await prisma.player.update({
      where: { id: existingBySteam.id },
      data: {
        discordName: input.discordName,
        steamName: profile.steamName,
        medal: locked ? existingBySteam.medal : medal,
        rolesJson: locked ? existingBySteam.rolesJson : stringifyRoles(roles),
      },
    });
    return {
      player,
      created: false,
      profileUrl: profile.profileUrl,
      openDotaLinked,
    };
  }

  if (
    existingByDiscord &&
    existingByDiscord.steam32 !== profile.steam32 &&
    allowMultiRegister()
  ) {
    const player = await prisma.player.create({
      data: {
        discordId: `${input.discordId}:${profile.steam32}`,
        discordName: input.discordName,
        steam32: profile.steam32,
        steamName: profile.steamName,
        medal,
        rolesJson: stringifyRoles(roles),
      },
    });
    return {
      player,
      created: true,
      profileUrl: profile.profileUrl,
      openDotaLinked,
    };
  }

  if (
    existingByDiscord &&
    existingByDiscord.steam32 !== profile.steam32
  ) {
    throw new Error(
      "This Discord account is already linked to a different Steam profile. Ask an admin to delete your registration with `/player delete` before using another Steam account.",
    );
  }

  if (existingByDiscord) {
    const locked = Boolean(existingByDiscord.teamId);
    const player = await prisma.player.update({
      where: { id: existingByDiscord.id },
      data: {
        discordName: input.discordName,
        steam32: profile.steam32,
        steamName: profile.steamName,
        medal: locked ? existingByDiscord.medal : medal,
        rolesJson: locked ? existingByDiscord.rolesJson : stringifyRoles(roles),
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
    },
  });
  return {
    player,
    created: true,
    profileUrl: profile.profileUrl,
    openDotaLinked,
  };
}
