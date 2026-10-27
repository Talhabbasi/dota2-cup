/**
 * Create and update private team chat + voice rooms from the live site.
 * Uses the bot token over REST, so the local gateway bot does not need to be running.
 *
 * Rooms follow the database: one text channel and one voice room per live team,
 * visible to that roster and Admin. Captain and Team · roles stay in discord-role-sync-rest.
 */

import { adminRoleName } from "./constants";
import { isDummyDiscordId, publicTeamWhere } from "./dummy";
import { liveRoster } from "./live-roster";
import { PLAY_WINDOW_ROLE_NAMES } from "./play-window";
import { prisma } from "./prisma";
import { currentSeasonFilter } from "./seasons";
import { CUP_NAME } from "@/lib/brand";

import { noteFailedResponse } from "./public-error";

const API = "https://discord.com/api/v10";
const TEAM_ROLE_PREFIX = "Team · ";

const VIEW_CHANNEL = 1 << 10;
const SEND_MESSAGES = 1 << 11;
const MANAGE_CHANNELS = 1 << 4;
const MANAGE_MESSAGES = 1 << 13;
const EMBED_LINKS = 1 << 14;
const ATTACH_FILES = 1 << 15;
const READ_MESSAGE_HISTORY = 1 << 16;
const ADD_REACTIONS = 1 << 6;
const CONNECT = 1 << 20;
const SPEAK = 1 << 21;
const STREAM = 1 << 9;
const MUTE_MEMBERS = 1 << 22;
const MOVE_MEMBERS = 1 << 24;
const USE_VAD = 1 << 25;

const PLAYER_CHAT =
  VIEW_CHANNEL |
  SEND_MESSAGES |
  ATTACH_FILES |
  READ_MESSAGE_HISTORY |
  ADD_REACTIONS |
  EMBED_LINKS;
const STAFF_CHAT = PLAYER_CHAT | MANAGE_MESSAGES;
const BOT_CHAT = STAFF_CHAT | MANAGE_CHANNELS;
const DENY_TEXT = VIEW_CHANNEL | SEND_MESSAGES;

const PLAYER_VOICE = VIEW_CHANNEL | CONNECT | SPEAK | STREAM | USE_VAD;
const STAFF_VOICE = PLAYER_VOICE | MOVE_MEMBERS | MUTE_MEMBERS;
const BOT_VOICE = STAFF_VOICE | MANAGE_CHANNELS;
const DENY_VOICE = VIEW_CHANNEL | CONNECT;

const TEXT = 0;
const VOICE = 2;
const CATEGORY = 4;

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

const TEAM_COLORS = [
  0xc0392b, 0x2980b9, 0x27ae60, 0x8e44ad, 0xd35400, 0x16a085, 0xf1c40f,
  0x2c3e50,
];

type DiscordRole = { id: string; name: string };
type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
};

type LiveTeam = {
  name: string;
  players: { discordId: string; steamName: string; isCaptain: boolean }[];
};

type Overwrite = { id: string; type: 0 | 1; allow: string; deny: string };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function teamChatCategoryName() {
  return process.env.TEAM_CHAT_CATEGORY_NAME?.trim() || "Team Chat";
}

function teamVoiceCategoryName() {
  return process.env.TEAM_VOICE_CATEGORY_NAME?.trim() || "Team Voice";
}

function captainRoleName() {
  return process.env.CAPTAIN_ROLE_NAME?.trim() || "Captain";
}

function registeredRoleName() {
  return process.env.REGISTERED_ROLE_NAME?.trim() || "Registered";
}

function teamRoleName(teamName: string) {
  return `${TEAM_ROLE_PREFIX}${teamName}`.slice(0, 100);
}

function snowflake(discordId: string) {
  const id = discordId.split(":")[0]?.trim() ?? "";
  return /^\d{17,20}$/.test(id) ? id : "";
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

function voiceChannelName(teamName: string, captainName: string | null) {
  const label = captainName ? `${teamName} · ${captainName}` : teamName;
  return label.slice(0, 100);
}

function matchesTeamVoice(channelName: string, teamName: string) {
  const n = channelName.toLowerCase();
  const t = teamName.toLowerCase();
  return (
    n === t ||
    n.startsWith(`${t} ·`) ||
    n.startsWith(`${t} -`) ||
    n.startsWith(`${t}—`)
  );
}

function teamColor(teamName: string) {
  let hash = 0;
  for (const ch of teamName) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TEAM_COLORS[hash % TEAM_COLORS.length] ?? TEAM_COLORS[0];
}

function ow(id: string, type: 0 | 1, allow: number, deny: number): Overwrite {
  return { id, type, allow: String(allow), deny: String(deny) };
}

async function discord(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response | null> {
  const token = process.env.DISCORD_TOKEN?.trim();
  if (!token) return null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const headers: Record<string, string> = { Authorization: `Bot ${token}` };
    const init: RequestInit = { method, headers, cache: "no-store" };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    const res = await fetch(`${API}${path}`, init);
    if (res.status !== 429) {
      if (!res.ok) void noteFailedResponse(`Discord ${method} ${path}`, res);
      return res;
    }
    const data = (await res.json().catch(() => null)) as {
      retry_after?: number;
    } | null;
    await sleep(Math.ceil((data?.retry_after ?? 1) * 1000));
  }
  return null;
}

async function botUserId() {
  const res = await discord("GET", "/users/@me");
  if (!res?.ok) return null;
  const user = (await res.json()) as { id?: string };
  return user.id ?? null;
}

async function listRoles(guildId: string) {
  const res = await discord("GET", `/guilds/${guildId}/roles`);
  if (!res?.ok) return [] as DiscordRole[];
  return (await res.json()) as DiscordRole[];
}

async function listChannels(guildId: string) {
  const res = await discord("GET", `/guilds/${guildId}/channels`);
  if (!res?.ok) return [] as DiscordChannel[];
  return (await res.json()) as DiscordChannel[];
}

function findRole(roles: DiscordRole[], name: string) {
  const want = name.toLowerCase();
  return roles.find((role) => role.name.toLowerCase() === want) ?? null;
}

function findCategory(channels: DiscordChannel[], name: string) {
  const want = name.toLowerCase();
  return (
    channels.find(
      (channel) =>
        channel.type === CATEGORY && channel.name.toLowerCase() === want,
    ) ?? null
  );
}

async function ensureRole(guildId: string, roles: DiscordRole[], teamName: string) {
  const name = teamRoleName(teamName);
  const existing = findRole(roles, name);
  if (existing) return existing;
  const res = await discord("POST", `/guilds/${guildId}/roles`, {
    name,
    hoist: true,
    mentionable: true,
    color: teamColor(teamName),
  });
  if (!res?.ok) return null;
  const created = (await res.json()) as DiscordRole;
  roles.push(created);
  return created;
}

function sharedRoleIds(roles: DiscordRole[]) {
  return [
    registeredRoleName(),
    captainRoleName(),
    PLAY_WINDOW_ROLE_NAMES.evening,
    PLAY_WINDOW_ROLE_NAMES.late,
  ]
    .map((name) => findRole(roles, name)?.id)
    .filter((id): id is string => Boolean(id));
}

function lockOverwrites(
  guildId: string,
  roles: DiscordRole[],
  botId: string | null,
  deny: number,
  staffAllow: number,
  botAllow: number,
): Overwrite[] {
  const rows: Overwrite[] = [ow(guildId, 0, 0, deny)];
  for (const roleId of sharedRoleIds(roles)) {
    rows.push(ow(roleId, 0, 0, deny));
  }
  const admin = findRole(roles, adminRoleName());
  if (admin) rows.push(ow(admin.id, 0, staffAllow, 0));
  if (botId) rows.push(ow(botId, 1, botAllow, 0));
  return rows;
}

async function ensureCategory(
  guildId: string,
  channels: DiscordChannel[],
  roles: DiscordRole[],
  botId: string | null,
  name: string,
  deny: number,
  staffAllow: number,
  botAllow: number,
) {
  let category = findCategory(channels, name);
  if (!category) {
    const res = await discord("POST", `/guilds/${guildId}/channels`, {
      name,
      type: CATEGORY,
    });
    if (!res?.ok) return null;
    category = (await res.json()) as DiscordChannel;
    channels.push(category);
  }
  await discord("PATCH", `/channels/${category.id}`, {
    permission_overwrites: lockOverwrites(
      guildId,
      roles,
      botId,
      deny,
      staffAllow,
      botAllow,
    ),
  });
  return category;
}

async function memberId(
  guildId: string,
  discordId: string,
  cache: Map<string, string | null>,
) {
  if (isDummyDiscordId(discordId)) return null;
  const id = snowflake(discordId);
  if (!id) return null;
  if (cache.has(id)) return cache.get(id) ?? null;
  const res = await discord("GET", `/guilds/${guildId}/members/${id}`);
  const found = res?.ok ? id : null;
  cache.set(id, found);
  return found;
}

async function upsertChannel(
  guildId: string,
  channels: DiscordChannel[],
  existing: DiscordChannel | null,
  body: Record<string, unknown>,
) {
  if (existing) {
    const patch = { ...body };
    delete patch.type;
    const res = await discord("PATCH", `/channels/${existing.id}`, patch);
    if (!res?.ok) return existing;
    const updated = (await res.json()) as DiscordChannel;
    const index = channels.findIndex((channel) => channel.id === existing.id);
    if (index >= 0) channels[index] = { ...existing, ...updated };
    return channels[index] ?? updated;
  }
  const res = await discord("POST", `/guilds/${guildId}/channels`, body);
  if (!res?.ok) return null;
  const created = (await res.json()) as DiscordChannel;
  channels.push(created);
  return created;
}

async function syncTeam(
  guildId: string,
  channels: DiscordChannel[],
  roles: DiscordRole[],
  botId: string | null,
  team: LiveTeam,
  voiceLimit: number,
  members: Map<string, string | null>,
) {
  const teamRole = await ensureRole(guildId, roles, team.name);
  const chatCategory = await ensureCategory(
    guildId,
    channels,
    roles,
    botId,
    teamChatCategoryName(),
    DENY_TEXT,
    STAFF_CHAT,
    BOT_CHAT,
  );
  const voiceCategory = await ensureCategory(
    guildId,
    channels,
    roles,
    botId,
    teamVoiceCategoryName(),
    DENY_VOICE,
    STAFF_VOICE,
    BOT_VOICE,
  );

  const rosterIds: string[] = [];
  for (const player of team.players) {
    const id = await memberId(guildId, player.discordId, members);
    if (id) rosterIds.push(id);
  }

  if (chatCategory) {
    const chatName = textChannelName(team.name);
    const existing =
      channels.find(
        (channel) =>
          channel.type === TEXT &&
          channel.parent_id === chatCategory.id &&
          matchesTeamChat(channel.name, team.name),
      ) ?? null;
    const overwrites = lockOverwrites(
      guildId,
      roles,
      botId,
      DENY_TEXT,
      STAFF_CHAT,
      BOT_CHAT,
    );
    if (teamRole) overwrites.push(ow(teamRole.id, 0, PLAYER_CHAT, 0));
    for (const id of rosterIds) overwrites.push(ow(id, 1, PLAYER_CHAT, 0));
    await upsertChannel(guildId, channels, existing, {
      name: chatName,
      type: TEXT,
      parent_id: chatCategory.id,
      topic: `Private chat for ${team.name}. Only this roster can see it.`,
      permission_overwrites: overwrites,
    });
  }

  if (voiceCategory) {
    const captain =
      team.players.find((player) => player.isCaptain)?.steamName ?? null;
    const voiceName = voiceChannelName(team.name, captain);
    const existing =
      channels.find(
        (channel) =>
          channel.type === VOICE &&
          channel.parent_id === voiceCategory.id &&
          matchesTeamVoice(channel.name, team.name),
      ) ?? null;
    const overwrites = lockOverwrites(
      guildId,
      roles,
      botId,
      DENY_VOICE,
      STAFF_VOICE,
      BOT_VOICE,
    );
    for (const player of team.players) {
      const id = await memberId(guildId, player.discordId, members);
      if (!id) continue;
      overwrites.push(
        ow(id, 1, player.isCaptain ? STAFF_VOICE : PLAYER_VOICE, 0),
      );
    }
    await upsertChannel(guildId, channels, existing, {
      name: voiceName,
      type: VOICE,
      parent_id: voiceCategory.id,
      user_limit: voiceLimit,
      permission_overwrites: overwrites,
    });
  }
}

async function deleteChannel(channelId: string) {
  await discord("DELETE", `/channels/${channelId}`);
}

async function removeTeamRooms(
  guildId: string,
  channels: DiscordChannel[],
  roles: DiscordRole[],
  teamName: string,
) {
  const chat = findCategory(channels, teamChatCategoryName());
  const voice = findCategory(channels, teamVoiceCategoryName());
  for (const channel of channels) {
    const inChat =
      chat &&
      channel.type === TEXT &&
      channel.parent_id === chat.id &&
      matchesTeamChat(channel.name, teamName);
    const inVoice =
      voice &&
      channel.type === VOICE &&
      channel.parent_id === voice.id &&
      matchesTeamVoice(channel.name, teamName);
    if (inChat || inVoice) await deleteChannel(channel.id);
  }
  const role = findRole(roles, teamRoleName(teamName));
  if (role) {
    await discord("DELETE", `/guilds/${guildId}/roles/${role.id}`);
  }
}

async function renameTeamRooms(
  channels: DiscordChannel[],
  from: string,
  to: string,
  captainName: string | null,
) {
  if (from.trim().toLowerCase() === to.trim().toLowerCase()) return;
  const chat = findCategory(channels, teamChatCategoryName());
  const voice = findCategory(channels, teamVoiceCategoryName());
  const text = chat
    ? channels.find(
        (channel) =>
          channel.type === TEXT &&
          channel.parent_id === chat.id &&
          matchesTeamChat(channel.name, from),
      )
    : null;
  if (text) {
    await discord("PATCH", `/channels/${text.id}`, {
      name: textChannelName(to),
      topic: `Private chat for ${to}. Only this roster can see it.`,
    });
    text.name = textChannelName(to);
  }
  const room = voice
    ? channels.find(
        (channel) =>
          channel.type === VOICE &&
          channel.parent_id === voice.id &&
          matchesTeamVoice(channel.name, from),
      )
    : null;
  if (room) {
    const next = voiceChannelName(to, captainName);
    await discord("PATCH", `/channels/${room.id}`, { name: next });
    room.name = next;
  }
}

async function pruneExtraRooms(channels: DiscordChannel[], teams: LiveTeam[]) {
  const chat = findCategory(channels, teamChatCategoryName());
  const voice = findCategory(channels, teamVoiceCategoryName());
  for (const channel of [...channels]) {
    const staleText =
      chat &&
      channel.type === TEXT &&
      channel.parent_id === chat.id &&
      !teams.some((team) => matchesTeamChat(channel.name, team.name));
    const staleVoice =
      voice &&
      channel.type === VOICE &&
      channel.parent_id === voice.id &&
      !teams.some((team) => matchesTeamVoice(channel.name, team.name));
    if (staleText || staleVoice) await deleteChannel(channel.id);
  }
}

async function loadTeams(): Promise<LiveTeam[]> {
  return prisma.team.findMany({
    where: { ...(await currentSeasonFilter()), ...publicTeamWhere },
    orderBy: { name: "asc" },
    select: {
      name: true,
      players: {
        select: { discordId: true, steamName: true, isCaptain: true },
      },
    },
  });
}

/**
 * Refresh team chat and voice for the named teams, or for every live team
 * when `all` is set (season switch). `removeTeam` deletes that franchise's rooms.
 */
export async function pushDiscordTeamRooms(options?: {
  teamNames?: string[];
  removeTeam?: string;
  renameTeam?: { from: string; to: string };
  all?: boolean;
}) {
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  if (!process.env.DISCORD_TOKEN?.trim() || !guildId) return;
  if (
    !options?.all &&
    !options?.removeTeam &&
    !options?.renameTeam &&
    !options?.teamNames?.length
  ) {
    return;
  }

  try {
    const [roles, channels, botId, teams, roster] = await Promise.all([
      listRoles(guildId),
      listChannels(guildId),
      botUserId(),
      loadTeams(),
      liveRoster(),
    ]);
    const members = new Map<string, string | null>();

    if (options.removeTeam) {
      await removeTeamRooms(guildId, channels, roles, options.removeTeam);
    }
    if (options.renameTeam) {
      const captain =
        teams.find(
          (team) =>
            team.name.toLowerCase() === options.renameTeam!.to.toLowerCase(),
        )?.players.find((player) => player.isCaptain)?.steamName ?? null;
      await renameTeamRooms(
        channels,
        options.renameTeam.from,
        options.renameTeam.to,
        captain,
      );
    }

    const wanted = new Set(
      (options.teamNames ?? []).map((name) => name.trim().toLowerCase()),
    );
    if (options.renameTeam) wanted.add(options.renameTeam.to.trim().toLowerCase());
    const targets = options.all
      ? teams
      : teams.filter((team) => wanted.has(team.name.toLowerCase()));

    for (const team of targets) {
      await syncTeam(
        guildId,
        channels,
        roles,
        botId,
        team,
        roster.min,
        members,
      );
    }
    if (options.all) await pruneExtraRooms(channels, teams);
  } catch (error) {
    console.warn(
      `${CUP_NAME} team rooms:`,
      error instanceof Error ? error.message : error,
    );
  }
}
