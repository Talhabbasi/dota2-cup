import {
  ChannelType,
  type Guild,
  type GuildMember,
  type Role,
  type TextChannel,
} from "discord.js";
import { adminRoleName } from "./constants";
import {
  PLAY_WINDOW_ROLE_NAMES,
  type KickoffWindow,
  type PlayWindow,
} from "./play-window";
import { prisma } from "./prisma";

export function captainRoleName() {
  return process.env.CAPTAIN_ROLE_NAME?.trim() || "Captain";
}

function findTextChannel(guild: Guild, name: string): TextChannel | null {
  const found = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildText &&
      ch.name.toLowerCase() === name.toLowerCase(),
  );
  return found?.type === ChannelType.GuildText ? found : null;
}

function findRole(guild: Guild, name: string): Role | null {
  return (
    guild.roles.cache.find((role) => role.name.toLowerCase() === name.toLowerCase()) ??
    null
  );
}

export async function ensureCaptainRole(guild: Guild): Promise<Role> {
  const name = captainRoleName();
  const existing = findRole(guild, name);
  if (existing) return existing;
  return guild.roles.create({
    name,
    hoist: true,
    mentionable: true,
    color: 0xb07d1f,
    reason: "MM Dota Cup captain role",
  });
}

async function allowStaff(
  channel: TextChannel,
  role: Role | GuildMember,
  extra: Record<string, boolean> = {},
) {
  await channel.permissionOverwrites.edit(role, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    EmbedLinks: true,
    AttachFiles: true,
    AddReactions: true,
    ...extra,
  });
}

export async function syncCupChannelAccess(guild: Guild) {
  await guild.channels.fetch();
  await guild.roles.fetch();

  const captainRole = await ensureCaptainRole(guild);
  const adminRole = findRole(guild, adminRoleName());
  const botMember = guild.members.me;

  const captains = findTextChannel(guild, "captains");
  if (captains) {
    await captains.permissionOverwrites.edit(guild.roles.everyone, {
      ViewChannel: false,
      SendMessages: false,
    });
    await allowStaff(captains, captainRole);
    if (adminRole) {
      await allowStaff(captains, adminRole, { ManageMessages: true });
    }
    if (botMember) {
      await allowStaff(captains, botMember, { ManageMessages: true });
    }
  }

  const auction = findTextChannel(guild, "auction");
  if (auction) {
    await auction.permissionOverwrites.edit(guild.roles.everyone, {
      ViewChannel: true,
      ReadMessageHistory: true,
      SendMessages: false,
      SendMessagesInThreads: false,
      CreatePublicThreads: false,
      CreatePrivateThreads: false,
      AddReactions: false,
    });
    await allowStaff(auction, captainRole);
    if (adminRole) {
      await allowStaff(auction, adminRole, { ManageMessages: true });
    }
    if (botMember) {
      await allowStaff(auction, botMember, { ManageMessages: true });
    }
  }
}

export async function ensurePlayWindowRole(
  guild: Guild,
  window: KickoffWindow,
): Promise<Role> {
  const name = PLAY_WINDOW_ROLE_NAMES[window];
  const existing = findRole(guild, name);
  if (existing) return existing;
  return guild.roles.create({
    name,
    hoist: false,
    mentionable: true,
    colors: { primaryColor: window === "evening" ? 0xc9a227 : 0x4a6fa5 },
    reason: "MM Dota Cup weekend play window",
  });
}

export async function setMemberPlayWindowRoles(
  guild: Guild,
  discordId: string,
  window: PlayWindow,
) {
  const member = await guild.members.fetch(discordId.split(":")[0]).catch(() => null);
  if (!member) return;
  const evening = await ensurePlayWindowRole(guild, "evening");
  const late = await ensurePlayWindowRole(guild, "late");
  const wantEvening = window === "evening" || window === "both";
  const wantLate = window === "late" || window === "both";
  const ops: Promise<unknown>[] = [];
  if (wantEvening && !member.roles.cache.has(evening.id)) {
    ops.push(member.roles.add(evening, "Cup weekend window"));
  }
  if (!wantEvening && member.roles.cache.has(evening.id)) {
    ops.push(member.roles.remove(evening, "Cup weekend window"));
  }
  if (wantLate && !member.roles.cache.has(late.id)) {
    ops.push(member.roles.add(late, "Cup weekend window"));
  }
  if (!wantLate && member.roles.cache.has(late.id)) {
    ops.push(member.roles.remove(late, "Cup weekend window"));
  }
  await Promise.all(ops);
}

export async function trySetPlayWindowRoles(
  guild: Guild | null,
  discordId: string,
  window: PlayWindow,
) {
  if (!guild) return;
  try {
    await setMemberPlayWindowRoles(guild, discordId, window);
  } catch (error) {
    console.warn(
      "Could not assign play-window Discord roles (need Manage Roles):",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function setMemberCaptainRole(
  guild: Guild,
  discordId: string,
  on: boolean,
) {
  const role = await ensureCaptainRole(guild);
  const member = await guild.members.fetch(discordId).catch(() => null);
  if (!member) return;
  if (on) {
    await member.roles.add(role, "Appointed cup captain");
    return;
  }
  await member.roles.remove(role, "Removed as cup captain");
}

export async function syncCaptainRolesFromDb(guild: Guild) {
  const role = await ensureCaptainRole(guild);
  const captains = await prisma.player.findMany({
    where: { isCaptain: true },
    select: { discordId: true },
  });
  for (const captain of captains) {
    const discordId = captain.discordId.split(":")[0];
    const member = await guild.members.fetch(discordId).catch(() => null);
    if (member && !member.roles.cache.has(role.id)) {
      await member.roles.add(role, "Sync cup captain role");
    }
  }
}

export function describeChannelAccess() {
  return [
    `#captains — only **${captainRoleName()}** and **${adminRoleName()}** can see and chat.`,
    `#auction — everyone can watch; only **${captainRoleName()}** and **${adminRoleName()}** can send messages.`,
  ].join("\n");
}
