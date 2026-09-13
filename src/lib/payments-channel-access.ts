import {
  ChannelType,
  OverwriteType,
  type Guild,
  type Role,
  type TextChannel,
} from "discord.js";
import { adminRoleName } from "./constants";
import { prisma } from "./prisma";
import { paymentsChannelName } from "./registration-status";

const DUMMY_PREFIX = "test-dummy-";
const DUMMY_TEAM_PREFIX = "test-dummy-team-";

const PLAYER_CHAT = {
  ViewChannel: true,
  SendMessages: true,
  AttachFiles: true,
  ReadMessageHistory: true,
  AddReactions: true,
  EmbedLinks: true,
} as const;

/** View only — do not deny SendMessages here, or captains with this role could not bid. */
const PLAYER_WATCH = {
  ViewChannel: true,
  ReadMessageHistory: true,
} as const;

type AccessKind = "chat" | "watch";

type ChannelSpec = {
  names: string[];
  kind: AccessKind;
};

function registeredChannelSpecs(): ChannelSpec[] {
  const payments = paymentsChannelName().toLowerCase();
  return [
    {
      names: [...new Set([payments, "payment", "payments"])],
      kind: "chat",
    },
    { names: ["teams", "team"], kind: "chat" },
    { names: ["results", "result"], kind: "chat" },
    { names: ["auction"], kind: "watch" },
  ];
}

export function registeredRoleName() {
  return process.env.REGISTERED_ROLE_NAME?.trim() || "Registered";
}

function isDummyDiscordId(discordId: string) {
  return (
    discordId.startsWith(DUMMY_PREFIX) ||
    discordId.startsWith(DUMMY_TEAM_PREFIX)
  );
}

function snowflake(discordId: string) {
  return discordId.split(":")[0];
}

function permsFor(kind: AccessKind) {
  return kind === "chat" ? PLAYER_CHAT : PLAYER_WATCH;
}

function findRole(guild: Guild, name: string): Role | null {
  return (
    guild.roles.cache.find(
      (role) => role.name.toLowerCase() === name.toLowerCase(),
    ) ?? null
  );
}

function findNamedTextChannel(guild: Guild, names: string[]): TextChannel | null {
  const wanted = names.map((n) => n.toLowerCase());
  const found = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildText &&
      wanted.includes(ch.name.toLowerCase()),
  );
  return found?.type === ChannelType.GuildText ? found : null;
}

function findLockedChannels(guild: Guild) {
  return registeredChannelSpecs().flatMap((spec) => {
    const channel = findNamedTextChannel(guild, spec.names);
    return channel ? [{ channel, kind: spec.kind }] : [];
  });
}

async function registeredSnowflakes() {
  const players = await prisma.player.findMany({
    where: {
      AND: [
        { discordId: { not: { startsWith: DUMMY_PREFIX } } },
        { discordId: { not: { startsWith: DUMMY_TEAM_PREFIX } } },
      ],
    },
    select: { discordId: true },
  });
  return [...new Set(players.map((p) => snowflake(p.discordId)))];
}

export async function ensureRegisteredRole(guild: Guild): Promise<Role> {
  await guild.roles.fetch();
  const name = registeredRoleName();
  const existing = findRole(guild, name);
  if (existing) return existing;
  try {
    return await guild.roles.create({
      name,
      hoist: false,
      mentionable: false,
      colors: { primaryColor: 0xb07d1f },
      reason: "MM Dota Cup — registered player channels",
    });
  } catch {
    throw new Error(
      `The bot cannot create the **${name}** role (needs **Manage Roles**). ` +
        `Create a role named **${name}**, drag the bot role above it, then run \`/admin setup\`.`,
    );
  }
}

async function allowStaff(channel: TextChannel, guild: Guild) {
  const adminRole = findRole(guild, adminRoleName());
  if (adminRole) {
    await channel.permissionOverwrites.edit(adminRole, {
      ...PLAYER_CHAT,
      ManageMessages: true,
    });
  }
  const botMember = guild.members.me;
  if (botMember) {
    await channel.permissionOverwrites.edit(botMember, {
      ...PLAYER_CHAT,
      ManageMessages: true,
    });
  }
}

async function grantViaMemberOverwrite(
  channel: TextChannel,
  discordId: string,
  kind: AccessKind,
) {
  await channel.permissionOverwrites.edit(discordId, permsFor(kind));
}

async function revokeMemberOverwrite(channel: TextChannel, discordId: string) {
  const overwrite = channel.permissionOverwrites.cache.get(discordId);
  if (overwrite?.type === OverwriteType.Member) {
    await channel.permissionOverwrites.delete(discordId).catch(() => undefined);
  }
}

async function hideFromEveryone(channel: TextChannel, guild: Guild) {
  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    ViewChannel: false,
  });
  await allowStaff(channel, guild);
}

async function syncMemberOverwrites(
  channel: TextChannel,
  guild: Guild,
  kind: AccessKind,
) {
  const ids = new Set(await registeredSnowflakes());
  const botId = guild.members.me?.id;
  for (const overwrite of channel.permissionOverwrites.cache.values()) {
    if (overwrite.type !== OverwriteType.Member) continue;
    if (overwrite.id === botId) continue;
    if (!ids.has(overwrite.id)) {
      await channel.permissionOverwrites.delete(overwrite.id).catch(() => undefined);
    }
  }
  for (const id of ids) {
    await grantViaMemberOverwrite(channel, id, kind);
  }
}

async function syncRegisteredRoleMembers(
  guild: Guild,
  role: Role,
  channels: { channel: TextChannel; kind: AccessKind }[],
) {
  const ids = await registeredSnowflakes();
  for (const id of ids) {
    const member = await guild.members.fetch(id).catch(() => null);
    if (!member) continue;
    if (member.roles.cache.has(role.id)) continue;
    try {
      await member.roles.add(role, "Cup registered — private cup channels");
    } catch (error) {
      console.warn(
        `Could not give ${registeredRoleName()} to ${id}; granting channel access instead:`,
        error instanceof Error ? error.message : error,
      );
      for (const entry of channels) {
        await grantViaMemberOverwrite(entry.channel, id, entry.kind).catch(
          () => undefined,
        );
      }
    }
  }
}

async function applyRegisteredAccess(
  channel: TextChannel,
  guild: Guild,
  kind: AccessKind,
  role: Role | null,
) {
  await hideFromEveryone(channel, guild);
  if (role) {
    await channel.permissionOverwrites.edit(role, permsFor(kind));
    return;
  }
  await syncMemberOverwrites(channel, guild, kind);
}

/** Hide a payments channel from @everyone; only registered players and staff can see it. */
export async function lockPaymentsChannel(
  channel: TextChannel,
  guild: Guild,
): Promise<string> {
  await guild.roles.fetch();
  let role: Role | null = null;
  try {
    role = await ensureRegisteredRole(guild);
  } catch (error) {
    console.warn(
      "Registered role unavailable; using per-player #payments access:",
      error instanceof Error ? error.message : error,
    );
  }
  await applyRegisteredAccess(channel, guild, "chat", role);
  if (role) {
    await syncRegisteredRoleMembers(guild, role, [{ channel, kind: "chat" }]);
  }
  return `registered players only${role ? ` (${registeredRoleName()})` : ""} — ${channel}`;
}

/** Hide #payments, #teams, #results, and #auction from anyone who is not registered. */
export async function lockRegisteredPlayerChannels(guild: Guild) {
  await guild.channels.fetch();
  await guild.roles.fetch();
  const channels = findLockedChannels(guild);
  if (channels.length === 0) return;

  let role: Role | null = null;
  try {
    role = await ensureRegisteredRole(guild);
  } catch (error) {
    console.warn(
      "Registered role unavailable; using per-player channel access:",
      error instanceof Error ? error.message : error,
    );
  }

  for (const entry of channels) {
    try {
      await applyRegisteredAccess(entry.channel, guild, entry.kind, role);
    } catch (error) {
      console.warn(
        `Could not lock #${entry.channel.name} to registered players:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (role) {
    await syncRegisteredRoleMembers(guild, role, channels);
  }
}

export async function trySetMemberRegisteredRole(
  guild: Guild | null,
  discordId: string,
  on: boolean,
) {
  if (!guild || isDummyDiscordId(discordId)) return;
  const id = snowflake(discordId);
  try {
    await guild.channels.fetch();
    const channels = findLockedChannels(guild);
    let role = findRole(guild, registeredRoleName());
    if (on && !role) {
      try {
        role = await ensureRegisteredRole(guild);
      } catch {
        role = null;
      }
    }

    if (role) {
      const member = await guild.members.fetch(id).catch(() => null);
      if (member) {
        if (on && !member.roles.cache.has(role.id)) {
          await member.roles.add(role, "Cup registered — private cup channels");
        }
        if (!on && member.roles.cache.has(role.id)) {
          await member.roles.remove(role, "Removed from cup");
        }
      }
      if (on) {
        for (const entry of channels) {
          await entry.channel.permissionOverwrites
            .edit(role, permsFor(entry.kind))
            .catch(() => undefined);
        }
      }
      return;
    }

    for (const entry of channels) {
      if (on) await grantViaMemberOverwrite(entry.channel, id, entry.kind);
      else await revokeMemberOverwrite(entry.channel, id);
    }
  } catch (error) {
    console.warn(
      `Could not ${on ? "grant" : "revoke"} registered channel access for ${id}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
