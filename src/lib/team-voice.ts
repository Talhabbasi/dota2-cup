import {
  ChannelType,
  OverwriteType,
  type CategoryChannel,
  type Guild,
  type VoiceChannel,
} from "discord.js";
import { adminRoleName, MIN_ROSTER } from "./constants";
import { registeredRoleName } from "./payments-channel-access";
import { PLAY_WINDOW_ROLE_NAMES } from "./play-window";
import { prisma } from "./prisma";

const DUMMY_PREFIX = "test-dummy-";
const DUMMY_TEAM_PREFIX = "test-dummy-team-";

const STAFF_VOICE = {
  ViewChannel: true,
  Connect: true,
  Speak: true,
  Stream: true,
  UseVAD: true,
  MoveMembers: true,
  MuteMembers: true,
} as const;

const PLAYER_VOICE = {
  ViewChannel: true,
  Connect: true,
  Speak: true,
  Stream: true,
  UseVAD: true,
} as const;

export function teamVoiceCategoryName() {
  return process.env.TEAM_VOICE_CATEGORY_NAME?.trim() || "Team Voice";
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

async function rosterMember(guild: Guild, discordId: string) {
  if (isDummyDiscordId(discordId)) return null;
  const id = snowflake(discordId);
  if (!/^\d{17,20}$/.test(id)) return null;
  return guild.members.fetch(id).catch(() => null);
}

function voiceChannelName(teamName: string, captainName: string | null) {
  const label = captainName ? `${teamName} · ${captainName}` : teamName;
  return label.slice(0, 100);
}

function matchesTeam(channelName: string, teamName: string) {
  const n = channelName.toLowerCase();
  const t = teamName.toLowerCase();
  return n === t || n.startsWith(`${t} ·`) || n.startsWith(`${t} -`) || n.startsWith(`${t}—`);
}

function captainRoleName() {
  return process.env.CAPTAIN_ROLE_NAME?.trim() || "Captain";
}

async function ensureTeamVoiceCategory(guild: Guild): Promise<CategoryChannel> {
  const name = teamVoiceCategoryName();
  const fromCache = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildCategory &&
      ch.name.toLowerCase() === name.toLowerCase(),
  );
  const existing =
    fromCache ??
    (await guild.channels.fetch().then(() =>
      guild.channels.cache.find(
        (ch) =>
          ch.type === ChannelType.GuildCategory &&
          ch.name.toLowerCase() === name.toLowerCase(),
      ),
    ));
  const category =
    existing?.type === ChannelType.GuildCategory
      ? existing
      : await guild.channels.create({
          name,
          type: ChannelType.GuildCategory,
          reason: "MM Dota Cup team voice rooms",
        });
  await lockCategoryFromEveryone(category, guild);
  return category;
}

async function provisionTeamVoice(
  guild: Guild,
  category: CategoryChannel,
  team: {
    name: string;
    players: { discordId: string; steamName?: string | null; isCaptain: boolean }[];
  },
) {
  const captain = team.players.find((p) => p.isCaptain) ?? null;
  const name = voiceChannelName(team.name, captain?.steamName ?? null);
  const existing = category.children.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildVoice && matchesTeam(ch.name, team.name),
  );
  let channel: VoiceChannel;
  if (existing?.type === ChannelType.GuildVoice) {
    channel = existing;
    if (channel.name !== name) {
      await channel.setName(name, "Sync team / captain name");
    }
    if (channel.userLimit !== MIN_ROSTER) {
      await channel.setUserLimit(MIN_ROSTER, "Starting five voice cap");
    }
  } else {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      parent: category.id,
      userLimit: MIN_ROSTER,
      reason: `MM Dota Cup voice for ${team.name}`,
    });
  }
  await applyVoiceAccess(channel, guild, team.players);
  return { channel, name, captain };
}

/** Create or refresh one team's private voice room. */
export async function syncTeamVoiceForTeam(
  guild: Guild,
  team: {
    name: string;
    players: { discordId: string; steamName?: string | null; isCaptain: boolean }[];
  },
) {
  const category = await ensureTeamVoiceCategory(guild);
  await provisionTeamVoice(guild, category, team);
}

/** Delete that team's voice room after the franchise is dissolved. */
export async function removeTeamVoicePresence(guild: Guild, teamName: string) {
  const categoryName = teamVoiceCategoryName().toLowerCase();
  const category =
    guild.channels.cache.find(
      (ch) =>
        ch.type === ChannelType.GuildCategory &&
        ch.name.toLowerCase() === categoryName,
    ) ??
    (await guild.channels.fetch().then(() =>
      guild.channels.cache.find(
        (ch) =>
          ch.type === ChannelType.GuildCategory &&
          ch.name.toLowerCase() === categoryName,
      ),
    ));
  if (category?.type !== ChannelType.GuildCategory) return;
  const existing = category.children.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildVoice && matchesTeam(ch.name, teamName),
  );
  if (existing) {
    await existing.delete("Team dissolved").catch(() => undefined);
  }
}

/** Keep the same voice room when a team is renamed (does not recreate fixtures). */
export async function renameTeamVoiceLabel(
  guild: Guild,
  oldName: string,
  newName: string,
  captainName: string | null,
) {
  if (oldName === newName) return;
  await guild.channels.fetch();

  const categoryName = teamVoiceCategoryName().toLowerCase();
  const category = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildCategory &&
      ch.name.toLowerCase() === categoryName,
  );
  if (category?.type !== ChannelType.GuildCategory) return;

  const existing = category.children.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildVoice && matchesTeam(ch.name, oldName),
  );
  if (existing?.type !== ChannelType.GuildVoice) return;

  const next = voiceChannelName(newName, captainName);
  if (existing.name !== next) {
    await existing.setName(next, "Team renamed");
  }
}

function findRole(guild: Guild, name: string) {
  return (
    guild.roles.cache.find(
      (role) => role.name.toLowerCase() === name.toLowerCase(),
    ) ?? null
  );
}

/** Hide from @everyone, Registered, Captain, and play-window roles. Roster member overwrites still win. */
async function denySharedRoles(
  channel: CategoryChannel | VoiceChannel,
  guild: Guild,
) {
  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    ViewChannel: false,
    Connect: false,
  });

  const denyView = { ViewChannel: false, Connect: false } as const;
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
  channel: CategoryChannel | VoiceChannel,
  guild: Guild,
) {
  const adminRole = findRole(guild, adminRoleName());
  if (adminRole) {
    await channel.permissionOverwrites.edit(adminRole, STAFF_VOICE);
  }
  const botMember = guild.members.me;
  if (botMember) {
    await channel.permissionOverwrites.edit(botMember, {
      ...STAFF_VOICE,
      ManageChannels: true,
      MoveMembers: true,
    });
  }
}

async function lockCategoryFromEveryone(category: CategoryChannel, guild: Guild) {
  await denySharedRoles(category, guild);
  await allowStaffRoles(category, guild);
}

async function applyVoiceAccess(
  channel: VoiceChannel,
  guild: Guild,
  roster: { discordId: string; isCaptain: boolean }[],
) {
  await denySharedRoles(channel, guild);
  await allowStaffRoles(channel, guild);

  const keep = new Set<string>();
  const botMember = guild.members.me;
  if (botMember) keep.add(botMember.id);

  for (const player of roster) {
    const member = await rosterMember(guild, player.discordId);
    if (!member) continue;
    keep.add(member.id);
    const perms = player.isCaptain ? STAFF_VOICE : PLAYER_VOICE;
    await channel.permissionOverwrites.edit(member, perms).catch((error) => {
      console.warn(
        `Could not set voice access for ${member.id} in ${channel.name}:`,
        error instanceof Error ? error.message : error,
      );
    });
  }

  for (const overwrite of channel.permissionOverwrites.cache.values()) {
    if (overwrite.type !== OverwriteType.Member) continue;
    if (keep.has(overwrite.id)) continue;
    await channel.permissionOverwrites.delete(overwrite.id).catch(() => undefined);
  }
}

export type TeamVoiceSyncResult = {
  ok: boolean;
  channel: string;
  detail: string;
};

/** One 5-player voice room per cup team. Captains and admins can drag members. */
export async function syncTeamVoiceChannels(
  guild: Guild,
): Promise<TeamVoiceSyncResult[]> {
  await guild.channels.fetch();
  await guild.roles.fetch();

  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    include: {
      players: {
        select: {
          discordId: true,
          steamName: true,
          isCaptain: true,
        },
      },
    },
  });

  const results: TeamVoiceSyncResult[] = [];
  let category: CategoryChannel;
  try {
    category = await ensureTeamVoiceCategory(guild);
  } catch (error) {
    return [
      {
        ok: false,
        channel: teamVoiceCategoryName(),
        detail:
          error instanceof Error
            ? `${error.message} — the bot needs **Manage Channels** to create team voice rooms.`
            : "Could not create Team Voice category",
      },
    ];
  }

  const claimed = new Set<string>();

  for (const team of teams) {
    const captain = team.players.find((p) => p.isCaptain) ?? null;
    const name = voiceChannelName(team.name, captain?.steamName ?? null);

    try {
      const { channel } = await provisionTeamVoice(guild, category, team);
      claimed.add(channel.id);
      const captainTag = captain ? captain.steamName : "no captain";
      results.push({
        ok: true,
        channel: name,
        detail: `5-player voice · captain **${captainTag}** can drag · ${channel}`,
      });
    } catch (error) {
      results.push({
        ok: false,
        channel: name,
        detail:
          error instanceof Error
            ? error.message
            : "Could not create team voice (need Manage Channels)",
      });
    }
  }

  for (const child of category.children.cache.values()) {
    if (child.type !== ChannelType.GuildVoice) continue;
    if (claimed.has(child.id)) continue;
    await child.delete("Team no longer in the cup").catch(() => undefined);
  }

  if (teams.length === 0) {
    results.push({
      ok: true,
      channel: teamVoiceCategoryName(),
      detail: "no teams yet — voice rooms appear when captains are appointed",
    });
  }

  return results;
}
