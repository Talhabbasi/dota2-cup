/**
 * Align Discord cup roles with the database using the bot token over REST.
 * The live site can do this without a logged-in gateway bot.
 *
 * Managed tags: Registered, Captain, play-window, and Team · {name}.
 * Other server roles (Admin, and anything else) are left alone.
 */

import { isDummyDiscordId, publicPlayerWhere } from "./dummy";
import { PLAY_WINDOW_ROLE_NAMES, playWindowOrBoth } from "./play-window";
import { prisma } from "./prisma";
import { getLiveSeason } from "./seasons";

const API = "https://discord.com/api/v10";
const TEAM_ROLE_PREFIX = "Team · ";

type DiscordRole = { id: string; name: string };

type DesiredCupRoles = {
  registered: boolean;
  captain: boolean;
  evening: boolean;
  late: boolean;
  teamName: string | null;
};

const EMPTY_DESIRED: DesiredCupRoles = {
  registered: false,
  captain: false,
  evening: false,
  late: false,
  teamName: null,
};

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
  return discordId.split(":")[0]?.trim() ?? "";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    if (res.status !== 429) return res;
    const data = (await res.json().catch(() => null)) as {
      retry_after?: number;
    } | null;
    await sleep(Math.ceil((data?.retry_after ?? 1) * 1000));
  }
  return null;
}

function roleNames() {
  return {
    registered: registeredRoleName(),
    captain: captainRoleName(),
    evening: PLAY_WINDOW_ROLE_NAMES.evening,
    late: PLAY_WINDOW_ROLE_NAMES.late,
  };
}

function isManagedCupRole(name: string) {
  const names = roleNames();
  const lower = name.toLowerCase();
  if (lower.startsWith(TEAM_ROLE_PREFIX.toLowerCase())) return true;
  return [names.registered, names.captain, names.evening, names.late].some(
    (label) => label.toLowerCase() === lower,
  );
}

/** Which managed roles to add or remove. Missing names must be created first. */
export function planCupRoleEdits(input: {
  memberRoleIds: string[];
  roles: DiscordRole[];
  desired: DesiredCupRoles;
}) {
  const names = roleNames();
  const wantedNames: string[] = [];
  if (input.desired.registered) wantedNames.push(names.registered);
  if (input.desired.captain) wantedNames.push(names.captain);
  if (input.desired.evening) wantedNames.push(names.evening);
  if (input.desired.late) wantedNames.push(names.late);
  if (input.desired.teamName) wantedNames.push(teamRoleName(input.desired.teamName));

  const byName = new Map(
    input.roles.map((role) => [role.name.toLowerCase(), role]),
  );
  const missingNames: string[] = [];
  const wantIds = new Set<string>();
  for (const name of wantedNames) {
    const role = byName.get(name.toLowerCase());
    if (!role) missingNames.push(name);
    else wantIds.add(role.id);
  }

  const managedIds = new Set(
    input.roles.filter((role) => isManagedCupRole(role.name)).map((role) => role.id),
  );
  const has = new Set(input.memberRoleIds);
  const add = [...wantIds].filter((id) => !has.has(id));
  const remove = [...has].filter((id) => managedIds.has(id) && !wantIds.has(id));
  return { add, remove, missingNames };
}

async function listRoles(guildId: string) {
  const res = await discord("GET", `/guilds/${guildId}/roles`);
  if (!res?.ok) return [] as DiscordRole[];
  return (await res.json()) as DiscordRole[];
}

async function ensureRole(
  guildId: string,
  name: string,
  color: number,
  hoist: boolean,
) {
  const created = await discord("POST", `/guilds/${guildId}/roles`, {
    name,
    color,
    hoist,
    mentionable: true,
  });
  if (!created?.ok) return null;
  return (await created.json()) as DiscordRole;
}

async function desiredForDiscord(discordId: string): Promise<DesiredCupRoles> {
  const live = await getLiveSeason();
  if (!live) return EMPTY_DESIRED;
  const id = snowflake(discordId);
  const row = await prisma.seasonPlayer.findFirst({
    where: {
      seasonId: live.id,
      player: {
        OR: [{ discordId: id }, { discordId: { startsWith: `${id}:` } }],
      },
    },
    select: {
      isCaptain: true,
      playWindow: true,
      team: { select: { name: true } },
      player: { select: { playWindow: true } },
    },
  });
  if (!row) return EMPTY_DESIRED;
  const window = playWindowOrBoth(row.playWindow ?? row.player.playWindow);
  return {
    registered: true,
    captain: row.isCaptain,
    evening: window === "evening" || window === "both",
    late: window === "late" || window === "both",
    teamName: row.team?.name ?? null,
  };
}

async function renameTeamRole(
  guildId: string,
  roles: DiscordRole[],
  from: string,
  to: string,
) {
  if (from.trim().toLowerCase() === to.trim().toLowerCase()) return roles;
  const previous = teamRoleName(from).toLowerCase();
  const next = teamRoleName(to);
  const role = roles.find((entry) => entry.name.toLowerCase() === previous);
  if (!role || role.name === next) return roles;
  const res = await discord("PATCH", `/guilds/${guildId}/roles/${role.id}`, {
    name: next,
  });
  if (!res?.ok) return roles;
  return roles.map((entry) =>
    entry.id === role.id ? { ...entry, name: next } : entry,
  );
}

async function syncOne(
  guildId: string,
  discordId: string,
  roles: DiscordRole[],
) {
  const id = snowflake(discordId);
  if (!/^\d{17,20}$/.test(id) || isDummyDiscordId(discordId)) return roles;

  const memberRes = await discord("GET", `/guilds/${guildId}/members/${id}`);
  if (!memberRes) return roles;
  if (memberRes.status === 404) return roles;
  if (!memberRes.ok) return roles;
  const member = (await memberRes.json()) as { roles?: string[] };
  const desired = await desiredForDiscord(discordId);

  let current = roles;
  let plan = planCupRoleEdits({
    memberRoleIds: member.roles ?? [],
    roles: current,
    desired,
  });
  for (const name of plan.missingNames) {
    const created = await ensureRole(
      guildId,
      name,
      name.toLowerCase().startsWith(TEAM_ROLE_PREFIX.toLowerCase())
        ? 0x5865f2
        : name.toLowerCase() === captainRoleName().toLowerCase()
          ? 0xb07d1f
          : name === PLAY_WINDOW_ROLE_NAMES.late
            ? 0x4a6fa5
            : name === PLAY_WINDOW_ROLE_NAMES.evening
              ? 0xc9a227
              : 0x3ba55d,
      name === PLAY_WINDOW_ROLE_NAMES.evening ||
        name === PLAY_WINDOW_ROLE_NAMES.late
        ? false
        : true,
    );
    if (created) current = [...current, created];
  }
  if (plan.missingNames.length > 0) {
    plan = planCupRoleEdits({
      memberRoleIds: member.roles ?? [],
      roles: current,
      desired,
    });
  }

  for (const roleId of plan.remove) {
    await discord(
      "DELETE",
      `/guilds/${guildId}/members/${id}/roles/${roleId}`,
    );
  }
  for (const roleId of plan.add) {
    await discord("PUT", `/guilds/${guildId}/members/${id}/roles/${roleId}`);
  }
  return current;
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
) {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        await fn(items[index]!);
      }
    },
  );
  await Promise.all(workers);
}

/**
 * Push cup roles for these Discord accounts, or for every real player when
 * `discordIds` is omitted (season switch).
 */
export async function pushDiscordRoleSync(
  discordIds?: string[],
  options?: { renameTeam?: { from: string; to: string } },
) {
  const guildId = process.env.DISCORD_GUILD_ID?.trim();
  if (!process.env.DISCORD_TOKEN?.trim() || !guildId) return;

  try {
    let ids = discordIds?.map((id) => id.trim()).filter(Boolean);
    if (!ids) {
      const players = await prisma.player.findMany({
        where: publicPlayerWhere,
        select: { discordId: true },
      });
      ids = players.map((player) => player.discordId);
    }
    ids = [...new Set(ids)];
    if (ids.length === 0 && !options?.renameTeam) return;

    let roles = await listRoles(guildId);
    if (options?.renameTeam) {
      roles = await renameTeamRole(
        guildId,
        roles,
        options.renameTeam.from,
        options.renameTeam.to,
      );
    }

    // One member at a time so a newly created Team role is visible to the next player.
    let cursor = roles;
    await mapPool(ids, 1, async (discordId) => {
      cursor = await syncOne(guildId, discordId, cursor);
    });
  } catch (error) {
    console.warn(
      "Discord role sync:",
      error instanceof Error ? error.message : error,
    );
  }
}
