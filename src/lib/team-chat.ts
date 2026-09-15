import {
  ChannelType,
  OverwriteType,
  type CategoryChannel,
  type Guild,
  type Role,
  type TextChannel,
} from "discord.js";
import { adminRoleName } from "./constants";
import { registeredRoleName } from "./payments-channel-access";
import { PLAY_WINDOW_ROLE_NAMES } from "./play-window";
import { prisma } from "./prisma";

const DUMMY_PREFIX = "test-dummy-";
const DUMMY_TEAM_PREFIX = "test-dummy-team-";
const TEAM_ROLE_PREFIX = "Team · ";

const RESERVED_TEXT_NAMES = new Set([
  "admin",
  "admins",
  "auction",
  "auction-test",
  "captains",
  "general",
  "payment",
  "payments",
  "register",
  "result",
  "results",
  "schedule",
  "team",
  "teams",
]);

const PLAYER_CHAT = {
  ViewChannel: true,
  SendMessages: true,
  AttachFiles: true,
  ReadMessageHistory: true,
  AddReactions: true,
  EmbedLinks: true,
} as const;

const STAFF_CHAT = {
  ...PLAYER_CHAT,
  ManageMessages: true,
} as const;

const TEAM_COLORS = [
  0xc0392b, 0x2980b9, 0x27ae60, 0x8e44ad, 0xd35400, 0x16a085, 0xf1c40f,
  0x2c3e50,
];

export function teamChatCategoryName() {
  return process.env.TEAM_CHAT_CATEGORY_NAME?.trim() || "Team Chat";
}

export function teamRoleName(teamName: string) {
  return `${TEAM_ROLE_PREFIX}${teamName}`.slice(0, 100);
}

function snowflake(discordId: string) {
  return discordId.split(":")[0];
}

function isDummyDiscordId(discordId: string) {
  return (
    discordId.startsWith(DUMMY_PREFIX) ||
    discordId.startsWith(DUMMY_TEAM_PREFIX)
  );
}

function isTeamRoleName(name: string) {
  return name.toLowerCase().startsWith(TEAM_ROLE_PREFIX.toLowerCase());
}

function slugTeamName(teamName: string) {
  const slug = teamName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return slug || "team";
}

function textChannelName(teamName: string) {
  const slug = slugTeamName(teamName);
  return RESERVED_TEXT_NAMES.has(slug) ? `chat-${slug}` : slug;
}

function matchesTeamChat(channelName: string, teamName: string) {
  const n = channelName.toLowerCase();
  const slug = slugTeamName(teamName);
  return n === slug || n === `chat-${slug}` || n === textChannelName(teamName);
}

function captainRoleName() {
  return process.env.CAPTAIN_ROLE_NAME?.trim() || "Captain";
}

function findRole(guild: Guild, name: string) {
  return (
    guild.roles.cache.find(
      (role) => role.name.toLowerCase() === name.toLowerCase(),
    ) ?? null
  );
}

function teamColor(teamName: string) {
  let hash = 0;
  for (const ch of teamName) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TEAM_COLORS[hash % TEAM_COLORS.length];
}

async function ensureTeamChatCategory(guild: Guild): Promise<CategoryChannel> {
  await guild.channels.fetch();
  const name = teamChatCategoryName();
  const existing = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildCategory &&
      ch.name.toLowerCase() === name.toLowerCase(),
  );
  const category =
    existing?.type === ChannelType.GuildCategory
      ? existing
      : await guild.channels.create({
          name,
          type: ChannelType.GuildCategory,
          reason: "MM Dota Cup private team chats",
        });
  await lockCategoryFromEveryone(category, guild);
  return category;
}

async function denySharedRoles(
  channel: CategoryChannel | TextChannel,
  guild: Guild,
) {
  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    ViewChannel: false,
    SendMessages: false,
  });

  const denyView = { ViewChannel: false, SendMessages: false } as const;
  const extras = [
    registeredRoleName(),
    captainRoleName(),
    PLAY_WINDOW_ROLE_NAMES.evening,
    PLAY_WINDOW_ROLE_NAMES.late,
  ];
  for (const name of extras) {
    const role = findRole(guild, name);
    if (role) {
      await channel.permissionOverwrites.edit(role, denyView);
    }
  }
}

async function allowStaffRoles(
  channel: CategoryChannel | TextChannel,
  guild: Guild,
) {
  const adminRole = findRole(guild, adminRoleName());
  if (adminRole) {
    await channel.permissionOverwrites.edit(adminRole, STAFF_CHAT);
  }
  const botMember = guild.members.me;
  if (botMember) {
    await channel.permissionOverwrites.edit(botMember, {
      ...STAFF_CHAT,
      ManageChannels: true,
    });
  }
}

async function lockCategoryFromEveryone(
  category: CategoryChannel,
  guild: Guild,
) {
  await denySharedRoles(category, guild);
  await allowStaffRoles(category, guild);
}

/** Keep the same Discord role + chat when a team is renamed (schedule uses team ids). */
export async function renameTeamChatLabels(
  guild: Guild,
  oldName: string,
  newName: string,
) {
  if (oldName === newName) return;
  await guild.roles.fetch();
  await guild.channels.fetch();

  const oldRole = findRole(guild, teamRoleName(oldName));
  const nextRoleName = teamRoleName(newName);
  if (oldRole && oldRole.name !== nextRoleName) {
    await oldRole.setName(nextRoleName, "Team renamed");
  }

  const categoryName = teamChatCategoryName().toLowerCase();
  const category = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildCategory &&
      ch.name.toLowerCase() === categoryName,
  );
  if (category?.type !== ChannelType.GuildCategory) return;

  const existing = category.children.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildText && matchesTeamChat(ch.name, oldName),
  );
  if (existing?.type !== ChannelType.GuildText) return;

  const nextChannel = textChannelName(newName);
  if (existing.name !== nextChannel) {
    await existing.setName(nextChannel, "Team renamed");
  }
  const topic = `Private chat for ${newName}. Only this roster can see it.`;
  if (existing.topic !== topic) {
    await existing.setTopic(topic, "Team renamed");
  }
}

async function ensureTeamRole(guild: Guild, teamName: string): Promise<Role> {
  const name = teamRoleName(teamName);
  const existing = findRole(guild, name);
  if (existing) return existing;
  try {
    return await guild.roles.create({
      name,
      hoist: true,
      mentionable: true,
      colors: { primaryColor: teamColor(teamName) },
      reason: `MM Dota Cup roster role for ${teamName}`,
    });
  } catch {
    throw new Error(
      `The bot cannot create the **${name}** role (needs **Manage Roles**). ` +
        `Drag the bot role above team roles, then run \`/admin setup\`.`,
    );
  }
}

async function applyChatAccess(
  channel: TextChannel,
  guild: Guild,
  teamRole: Role,
  roster: { discordId: string }[],
) {
  await denySharedRoles(channel, guild);
  await allowStaffRoles(channel, guild);
  await channel.permissionOverwrites.edit(teamRole, PLAYER_CHAT);

  const keep = new Set<string>();
  const botMember = guild.members.me;
  if (botMember) keep.add(botMember.id);

  for (const player of roster) {
    if (isDummyDiscordId(player.discordId)) continue;
    const id = snowflake(player.discordId);
    keep.add(id);
    await channel.permissionOverwrites.edit(id, PLAYER_CHAT).catch((error) => {
      console.warn(
        `Could not set team chat access for ${id} in ${channel.name}:`,
        error instanceof Error ? error.message : error,
      );
    });
  }

  for (const overwrite of channel.permissionOverwrites.cache.values()) {
    if (overwrite.type !== OverwriteType.Member) continue;
    if (keep.has(overwrite.id)) continue;
    await stripMemberTeamRole(guild, overwrite.id, teamRole).catch(
      () => undefined,
    );
    await channel.permissionOverwrites
      .delete(overwrite.id)
      .catch(() => undefined);
  }
}

async function stripMemberTeamRole(
  guild: Guild,
  discordId: string,
  role: Role,
) {
  const member = await guild.members
    .fetch(snowflake(discordId))
    .catch(() => null);
  if (member?.roles.cache.has(role.id)) {
    await member.roles.remove(role, "No longer on this cup team");
  }
}

export async function stripMemberTeamRoles(
  guild: Guild | null,
  discordId: string,
) {
  if (!guild || isDummyDiscordId(discordId)) return;
  const member = await guild.members
    .fetch(snowflake(discordId))
    .catch(() => null);
  if (!member) return;
  const roles = member.roles.cache.filter((role) => isTeamRoleName(role.name));
  for (const role of roles.values()) {
    await member.roles
      .remove(role, "Removed from cup team")
      .catch((error) => {
        console.warn(
          `Could not remove ${role.name} from ${member.id}:`,
          error instanceof Error ? error.message : error,
        );
      });
  }
}

async function syncPlayerTeamRole(
  guild: Guild,
  discordId: string,
  teamName: string | null,
  teamRoles: Map<string, Role>,
) {
  if (isDummyDiscordId(discordId)) return;
  const member = await guild.members
    .fetch(snowflake(discordId))
    .catch(() => null);
  if (!member) return;

  const want = teamName ? teamRoles.get(teamName) : null;
  for (const role of member.roles.cache.values()) {
    if (!isTeamRoleName(role.name)) continue;
    if (want && role.id === want.id) continue;
    await member.roles.remove(role, "Cup team role sync").catch(() => undefined);
  }
  if (want && !member.roles.cache.has(want.id)) {
    await member.roles.add(want, "Assigned to cup team").catch((error) => {
      console.warn(
        `Could not give ${want.name} to ${member.id}:`,
        error instanceof Error ? error.message : error,
      );
    });
  }
}

export type TeamChatSyncResult = {
  ok: boolean;
  channel: string;
  detail: string;
};

/** One private text channel + Discord role per cup team. Only that roster can see it. */
export async function syncTeamChatChannels(
  guild: Guild,
): Promise<TeamChatSyncResult[]> {
  await guild.channels.fetch();
  await guild.roles.fetch();

  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: {
      players: {
        select: {
          discordId: true,
          steamName: true,
        },
      },
    },
  });

  const results: TeamChatSyncResult[] = [];
  let category: CategoryChannel;
  try {
    category = await ensureTeamChatCategory(guild);
  } catch (error) {
    return [
      {
        ok: false,
        channel: teamChatCategoryName(),
        detail:
          error instanceof Error
            ? `${error.message} — the bot needs **Manage Channels** to create team chats.`
            : "Could not create Team Chat category",
      },
    ];
  }

  const claimed = new Set<string>();
  const claimedRoles = new Set<string>();
  const teamRoles = new Map<string, Role>();

  for (const team of teams) {
    const name = textChannelName(team.name);
    const existing = category.children.cache.find(
      (ch) =>
        ch.type === ChannelType.GuildText && matchesTeamChat(ch.name, team.name),
    );

    try {
      const role = await ensureTeamRole(guild, team.name);
      teamRoles.set(team.name, role);
      claimedRoles.add(role.id);

      let channel: TextChannel;
      if (existing?.type === ChannelType.GuildText) {
        channel = existing;
        if (channel.name !== name) {
          await channel.setName(name, "Sync team chat name");
        }
      } else {
        channel = await guild.channels.create({
          name,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: `Private chat for ${team.name}. Only this roster can see it.`,
          reason: `MM Dota Cup chat for ${team.name}`,
        });
      }
      claimed.add(channel.id);
      await applyChatAccess(channel, guild, role, team.players);
      for (const player of team.players) {
        await syncPlayerTeamRole(guild, player.discordId, team.name, teamRoles);
      }
      results.push({
        ok: true,
        channel: name,
        detail: `private team chat · ${team.players.length} on roster · ${channel}`,
      });
    } catch (error) {
      results.push({
        ok: false,
        channel: name,
        detail:
          error instanceof Error
            ? error.message
            : "Could not create team chat (need Manage Channels / Manage Roles)",
      });
    }
  }

  for (const child of category.children.cache.values()) {
    if (child.type !== ChannelType.GuildText) continue;
    if (claimed.has(child.id)) continue;
    await child.delete("Team no longer in the cup").catch(() => undefined);
  }

  for (const role of guild.roles.cache.values()) {
    if (!isTeamRoleName(role.name)) continue;
    if (claimedRoles.has(role.id)) continue;
    await role.delete("Team no longer in the cup").catch(() => undefined);
  }

  if (teams.length === 0) {
    results.push({
      ok: true,
      channel: teamChatCategoryName(),
      detail: "no teams yet — chats appear when captains are appointed",
    });
  }

  return results;
}
