/**
 * Discord REST cleanup after a season ends:
 * - Team Chat / Team Voice channels
 * - Cup roles: Team · *, Captain, Registered, play-window
 * Admin role is never deleted.
 */

import { PLAY_WINDOW_ROLE_NAMES } from "./play-window";

function teamChatCategoryName() {
  return process.env.TEAM_CHAT_CATEGORY_NAME?.trim() || "Team Chat";
}

function teamVoiceCategoryName() {
  return process.env.TEAM_VOICE_CATEGORY_NAME?.trim() || "Team Voice";
}

function adminRoleName() {
  return process.env.ADMIN_ROLE_NAME?.trim() || "Admin";
}

function captainRoleName() {
  return process.env.CAPTAIN_ROLE_NAME?.trim() || "Captain";
}

function registeredRoleName() {
  return process.env.REGISTERED_ROLE_NAME?.trim() || "Registered";
}

/** Exact-name cup roles wiped on season end (Admin is never in this list). */
export function cupSeasonRoleExactNames(): string[] {
  return [
    captainRoleName(),
    registeredRoleName(),
    PLAY_WINDOW_ROLE_NAMES.evening,
    PLAY_WINDOW_ROLE_NAMES.late,
  ];
}

/** True if this Discord role should be deleted when a season completes. */
export function isCupSeasonRoleToDelete(roleName: string): boolean {
  const name = roleName.trim();
  if (!name) return false;
  if (name.toLowerCase() === adminRoleName().toLowerCase()) return false;
  if (name.startsWith("Team · ")) return true;
  return cupSeasonRoleExactNames().some(
    (n) => n.toLowerCase() === name.toLowerCase(),
  );
}

async function discordBotFetch(
  method: string,
  path: string,
): Promise<Response | null> {
  const token = process.env.DISCORD_TOKEN?.trim();
  if (!token) return null;
  return fetch(`https://discord.com/api/v10${path}`, {
    method,
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });
}

/**
 * Deletes Team Chat/Voice rooms and all cup player roles.
 * Keeps Admin (and any non-cup server roles).
 */
export async function clearAllTeamDiscordRoomsViaRest(): Promise<{
  text: number;
  voice: number;
  roles: number;
  detail: string;
}> {
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  if (!guildId) {
    return {
      text: 0,
      voice: 0,
      roles: 0,
      detail: "DISCORD_GUILD_ID not set — skipped Discord cleanup",
    };
  }
  if (!process.env.DISCORD_TOKEN?.trim()) {
    return {
      text: 0,
      voice: 0,
      roles: 0,
      detail: "DISCORD_TOKEN not set — skipped Discord cleanup",
    };
  }

  const channelsRes = await discordBotFetch(
    "GET",
    `/guilds/${guildId}/channels`,
  );
  if (!channelsRes?.ok) {
    return {
      text: 0,
      voice: 0,
      roles: 0,
      detail: "Could not list Discord channels (check bot permissions)",
    };
  }

  type ApiChannel = {
    id: string;
    name: string;
    type: number;
    parent_id?: string | null;
  };
  const channels = (await channelsRes.json()) as ApiChannel[];
  // 4 = category, 0 = text, 2 = voice
  const chatCat = channels.find(
    (c) =>
      c.type === 4 &&
      c.name.toLowerCase() === teamChatCategoryName().toLowerCase(),
  );
  const voiceCat = channels.find(
    (c) =>
      c.type === 4 &&
      c.name.toLowerCase() === teamVoiceCategoryName().toLowerCase(),
  );

  let text = 0;
  let voice = 0;
  for (const ch of channels) {
    const underChat = chatCat && ch.parent_id === chatCat.id && ch.type === 0;
    const underVoice = voiceCat && ch.parent_id === voiceCat.id && ch.type === 2;
    if (!underChat && !underVoice) continue;
    const del = await discordBotFetch("DELETE", `/channels/${ch.id}`);
    if (del?.ok || del?.status === 204) {
      if (underChat) text += 1;
      if (underVoice) voice += 1;
    }
    await new Promise((r) => setTimeout(r, 350));
  }

  const rolesRes = await discordBotFetch("GET", `/guilds/${guildId}/roles`);
  let roles = 0;
  if (rolesRes?.ok) {
    const apiRoles = (await rolesRes.json()) as {
      id: string;
      name: string;
      managed?: boolean;
    }[];
    for (const role of apiRoles) {
      if (role.managed) continue;
      if (!isCupSeasonRoleToDelete(role.name)) continue;
      const del = await discordBotFetch(
        "DELETE",
        `/guilds/${guildId}/roles/${role.id}`,
      );
      if (del?.ok || del?.status === 204) roles += 1;
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  return {
    text,
    voice,
    roles,
    detail: `Cleared ${text} team chat(s), ${voice} team voice room(s), ${roles} cup role(s) (Admin kept)`,
  };
}
