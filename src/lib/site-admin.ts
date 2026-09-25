import { adminRoleName, isAdminDiscordId } from "./constants";

type GuildRole = { id: string; name: string };

let cachedAdminRoleId: { guildId: string; roleId: string | null; at: number } | null =
  null;
const ROLE_CACHE_MS = 5 * 60_000;

async function discordApi<T>(path: string): Promise<T | null> {
  const token = process.env.DISCORD_TOKEN?.trim();
  if (!token) return null;
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function adminRoleIdForGuild(guildId: string): Promise<string | null> {
  const now = Date.now();
  if (
    cachedAdminRoleId &&
    cachedAdminRoleId.guildId === guildId &&
    now - cachedAdminRoleId.at < ROLE_CACHE_MS
  ) {
    return cachedAdminRoleId.roleId;
  }
  const roles = await discordApi<GuildRole[]>(`/guilds/${guildId}/roles`);
  const want = adminRoleName().toLowerCase();
  const hit = roles?.find((role) => role.name.toLowerCase() === want) ?? null;
  cachedAdminRoleId = {
    guildId,
    roleId: hit?.id ?? null,
    at: now,
  };
  return hit?.id ?? null;
}

/**
 * True if this Discord user may use organizer tools on the website.
 * Matches the bot: ADMIN_DISCORD_IDS, or the guild Admin role.
 */
export async function isSiteAdmin(
  discordId: string | null | undefined,
): Promise<boolean> {
  if (!discordId) return false;
  if (isAdminDiscordId(discordId)) return true;

  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  if (!guildId) return false;

  const adminRoleId = await adminRoleIdForGuild(guildId);
  if (!adminRoleId) return false;

  const member = await discordApi<{ roles?: string[] }>(
    `/guilds/${guildId}/members/${discordId}`,
  );
  return Boolean(member?.roles?.includes(adminRoleId));
}
