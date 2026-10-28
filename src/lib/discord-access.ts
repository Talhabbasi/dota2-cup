import {
  ChannelType,
  type Guild,
  type GuildMember,
  type Role,
  type TextChannel,
} from "discord.js";
import { adminRoleName } from "./constants";
import { noteFailedResponse } from "./public-error";
import { ensureMatchesChannel, ensurePaymentsChannel } from "./cup-announcements";
import {
  ensureRegisteredRole,
  lockRegisteredPlayerChannels,
  trySetMemberRegisteredRole,
} from "./payments-channel-access";
import { ensureDummyAuctionChannel } from "./dummy-auction-channel";
import {
  removeTeamChatPresence,
  renameTeamChatLabels,
  stripMemberTeamRoles,
  syncTeamChatChannels,
  syncTeamChatForTeam,
  clearAllTeamChatChannels,
  teamChatCategoryName,
} from "./team-chat";
import {
  removeTeamVoicePresence,
  renameTeamVoiceLabel,
  syncTeamVoiceChannels,
  syncTeamVoiceForTeam,
  clearAllTeamVoiceChannels,
  teamVoiceCategoryName,
} from "./team-voice";
import {
  PLAY_WINDOW_ROLE_NAMES,
  playWindowOrBoth,
  type KickoffWindow,
  type PlayWindow,
} from "./play-window";
import { publicPlayerWhere } from "./dummy";
import { paidRoleName, unpaidRoleName } from "./payment-roles";
import { playerMustPay } from "./payments";
import { prisma } from "./prisma";
import { getLiveSeason } from "./seasons";
import { BOT_NAME, CUP_NAME } from "@/lib/brand";

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
  await guild.roles.fetch();
  const name = captainRoleName();
  const existing = findRole(guild, name);
  if (existing) return existing;
  try {
    return await guild.roles.create({
      name,
      hoist: true,
      mentionable: true,
      colors: { primaryColor: 0xb07d1f },
      reason: `${CUP_NAME} captain role`,
    });
  } catch {
    throw new Error(
      `The bot cannot create the **${name}** Discord role (needs **Manage Roles**). ` +
        `Server Settings → Roles → enable **Manage Roles** on **${BOT_NAME}**, ` +
        `and drag the bot role **above** ${name}. Or create a role named **${name}** yourself.`,
    );
  }
}

async function ensurePaymentRole(
  guild: Guild,
  kind: "paid" | "unpaid",
): Promise<Role | null> {
  await guild.roles.fetch();
  const name = kind === "paid" ? paidRoleName() : unpaidRoleName();
  const existing = findRole(guild, name);
  if (existing) {
    if (!existing.mentionable) {
      await existing.setMentionable(true, `${CUP_NAME} ${name} mention`).catch(() => undefined);
    }
    return existing;
  }
  try {
    return await guild.roles.create({
      name,
      hoist: false,
      mentionable: true,
      colors: { primaryColor: kind === "paid" ? 0x57f287 : 0xed4245 },
      reason: `${CUP_NAME} ${name} role`,
    });
  } catch (error) {
    console.warn(
      `Could not create ${name} Discord role:`,
      error instanceof Error ? error.message : error,
    );
    return findRole(guild, name);
  }
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

export async function syncCupChannelAccess(
  guild: Guild,
  options?: { syncRegisteredMembers?: boolean },
) {
  await guild.channels.fetch();
  await guild.roles.fetch();

  let captainRole = findRole(guild, captainRoleName());
  try {
    captainRole = await ensureCaptainRole(guild);
  } catch (error) {
    console.warn(
      "Could not create Captain role (need Manage Roles):",
      error instanceof Error ? error.message : error,
    );
  }
  const adminRole = findRole(guild, adminRoleName());
  const botMember = guild.members.me;

  const captains = findTextChannel(guild, "captains");
  if (captains && captainRole) {
    try {
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
    } catch (error) {
      console.warn(
        "Could not lock #captains (need Manage Roles):",
        error instanceof Error ? error.message : error,
      );
    }
  }

  try {
    await ensurePaymentsChannel(guild);
  } catch (error) {
    console.warn(
      "Could not create or lock #payments (bot needs Manage Channels):",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    await ensureMatchesChannel(guild);
  } catch (error) {
    console.warn(
      "Could not create #matches (bot needs Manage Channels):",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    await lockRegisteredPlayerChannels(guild, {
      syncMembers: options?.syncRegisteredMembers ?? true,
    });
  } catch (error) {
    console.warn(
      "Could not lock cup channels to registered players:",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    await syncTeamVoiceChannels(guild);
  } catch (error) {
    console.warn(
      "Could not sync team voice channels:",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    await syncTeamChatChannels(guild);
  } catch (error) {
    console.warn(
      "Could not sync team chat channels:",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    const testAuction = await ensureDummyAuctionChannel(guild, {
      botUserId: guild.client.user?.id,
    });
    console.log(`Admin-only #${testAuction.name} ready in ${guild.name}`);
  } catch (error) {
    console.warn(
      "Could not create Admin-only #auction-test:",
      error instanceof Error ? error.message : error,
    );
  }

  const auction = findTextChannel(guild, "auction");
  if (auction) {
    try {
      if (captainRole) {
        await allowStaff(auction, captainRole);
      }
      if (adminRole) {
        await allowStaff(auction, adminRole, { ManageMessages: true });
      }
      if (botMember) {
        await allowStaff(auction, botMember, { ManageMessages: true });
      }
    } catch (error) {
      console.warn(
        "Could not give captains send access in #auction:",
        error instanceof Error ? error.message : error,
      );
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
    reason: `${CUP_NAME} weekend play window`,
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

/** Assign the Discord Captain role without failing the cup DB update. */
export async function trySetMemberCaptainRole(
  guild: Guild | null,
  discordId: string,
  on: boolean,
): Promise<string | null> {
  if (!guild) return null;
  try {
    await setMemberCaptainRole(guild, discordId, on);
    return null;
  } catch (error) {
    const name = captainRoleName();
    const raw = error instanceof Error ? error.message : "Missing Permissions";
    const needsManage =
      /missing permissions/i.test(raw) ||
      raw.includes("Manage Roles") ||
      /cannot create the/i.test(raw);
    const hint = needsManage
      ? raw.includes("Manage Roles")
        ? raw
        : `The bot needs **Manage Roles**, and its role must sit **above** **${name}** in Server Settings → Roles.`
      : raw;
    console.warn("Captain Discord role:", raw);
    return on
      ? `They are captain in the cup, but Discord did not give them the **${name}** role. ${hint}`
      : `Captain was removed in the cup, but Discord could not take the **${name}** role off them. ${hint}`;
  }
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
) {
  if (items.length === 0) return;
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

async function fetchMembersByIds(guild: Guild, ids: string[]) {
  const unique = [
    ...new Set(ids.filter((id) => /^\d{17,20}$/.test(id))),
  ];
  const byId = new Map<string, GuildMember>();
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    try {
      const fetched = await guild.members.fetch({ user: chunk });
      for (const [id, member] of fetched) byId.set(id, member);
    } catch {
      await mapPool(chunk, 10, async (id) => {
        const member = await guild.members.fetch(id).catch(() => null);
        if (member) byId.set(id, member);
      });
    }
  }
  return byId;
}

export async function syncCaptainRolesFromDb(guild: Guild) {
  // Captain tags are synced inside syncLiveSeasonDiscordRoles (single pass).
  await syncLiveSeasonDiscordRoles(guild);
}

/**
 * Discord cup tags follow the live season only (fast batched pass):
 * - Season members keep Registered, Paid or Unpaid, and their weekend window
 * - Everyone else loses Registered / Paid / Unpaid / weekend / team / Captain leftovers
 */
export async function syncLiveSeasonDiscordRoles(guild: Guild) {
  await guild.roles.fetch();

  const registeredRole = await ensureRegisteredRole(guild).catch(() => null);
  let captainRole: Role | null = findRole(guild, captainRoleName());
  try {
    captainRole = await ensureCaptainRole(guild);
  } catch {
    captainRole = findRole(guild, captainRoleName());
  }

  const eveningRole = await ensurePlayWindowRole(guild, "evening").catch(
    () => findRole(guild, PLAY_WINDOW_ROLE_NAMES.evening),
  );
  const lateRole = await ensurePlayWindowRole(guild, "late").catch(() =>
    findRole(guild, PLAY_WINDOW_ROLE_NAMES.late),
  );
  const paidRole = await ensurePaymentRole(guild, "paid");
  const unpaidRole = await ensurePaymentRole(guild, "unpaid");

  const live = await getLiveSeason();
  const liveRows = live
    ? await prisma.seasonPlayer.findMany({
        where: { seasonId: live.id, player: publicPlayerWhere },
        select: {
          isCaptain: true,
          rosterRole: true,
          paidAt: true,
          playWindow: true,
          player: { select: { discordId: true, playWindow: true } },
        },
      })
    : [];

  const liveByDiscord = new Map(
    liveRows.map((row) => [
      row.player.discordId.split(":")[0],
      {
        window: playWindowOrBoth(row.playWindow ?? row.player.playWindow),
        isCaptain: row.isCaptain,
        owesFee: playerMustPay(row.rosterRole),
        paid: Boolean(row.paidAt),
      },
    ]),
  );

  const allPlayers = await prisma.player.findMany({
    where: publicPlayerWhere,
    select: { discordId: true },
  });
  const allIds = allPlayers.map((p) => p.discordId.split(":")[0]);
  const members = await fetchMembersByIds(guild, allIds);

  let revoked = 0;
  let granted = 0;

  await mapPool(allIds, 12, async (id) => {
    const member = members.get(id);
    if (!member) return;
    const live = liveByDiscord.get(id);

    if (!live) {
      const junk = member.roles.cache.filter(
        (role) =>
          role.id === registeredRole?.id ||
          role.id === captainRole?.id ||
          role.id === eveningRole?.id ||
          role.id === lateRole?.id ||
          role.id === paidRole?.id ||
          role.id === unpaidRole?.id ||
          role.name.toLowerCase().startsWith("team · "),
      );
      if (junk.size === 0) return;
      await member.roles
        .remove(junk, "Not registered for the live season")
        .catch(() => undefined);
      revoked += 1;
      return;
    }

    const wantEvening = live.window === "evening" || live.window === "both";
    const wantLate = live.window === "late" || live.window === "both";
    const toAdd: Role[] = [];
    const toRemove: Role[] = [];

    if (registeredRole && !member.roles.cache.has(registeredRole.id)) {
      toAdd.push(registeredRole);
    }
    if (live.isCaptain && captainRole && !member.roles.cache.has(captainRole.id)) {
      toAdd.push(captainRole);
    }
    if (!live.isCaptain && captainRole && member.roles.cache.has(captainRole.id)) {
      toRemove.push(captainRole);
    }
    if (eveningRole) {
      if (wantEvening && !member.roles.cache.has(eveningRole.id)) {
        toAdd.push(eveningRole);
      }
      if (!wantEvening && member.roles.cache.has(eveningRole.id)) {
        toRemove.push(eveningRole);
      }
    }
    if (lateRole) {
      if (wantLate && !member.roles.cache.has(lateRole.id)) {
        toAdd.push(lateRole);
      }
      if (!wantLate && member.roles.cache.has(lateRole.id)) {
        toRemove.push(lateRole);
      }
    }
    const wantPaid = live.owesFee && live.paid;
    const wantUnpaid = live.owesFee && !live.paid;
    if (paidRole) {
      if (wantPaid && !member.roles.cache.has(paidRole.id)) toAdd.push(paidRole);
      if (!wantPaid && member.roles.cache.has(paidRole.id)) toRemove.push(paidRole);
    }
    if (unpaidRole) {
      if (wantUnpaid && !member.roles.cache.has(unpaidRole.id)) toAdd.push(unpaidRole);
      if (!wantUnpaid && member.roles.cache.has(unpaidRole.id)) toRemove.push(unpaidRole);
    }

    if (toRemove.length > 0) {
      await member.roles
        .remove(toRemove, "Sync live-season cup roles")
        .catch(() => undefined);
    }
    if (toAdd.length > 0) {
      await member.roles
        .add(toAdd, "Sync live-season cup roles")
        .catch(() => undefined);
    }
    granted += 1;
  });

  await lockRegisteredPlayerChannels(guild, { syncMembers: false });

  console.log(
    `Live-season Discord roles: synced ${granted} live, cleared tags on ${revoked} non-live (batched)`,
  );
}

export async function trySyncCupChannelAccess(guild: Guild | null) {
  if (!guild) return;
  try {
    await syncCupChannelAccess(guild);
  } catch (error) {
    console.warn(
      "Could not sync cup channel access:",
      error instanceof Error ? error.message : error,
    );
  }
}

/** Create that franchise's private chat, role, and voice — skip a full guild rebuild. */
export async function tryProvisionTeamDiscord(
  guild: Guild | null,
  team: {
    name: string;
    players: {
      discordId: string;
      steamName?: string | null;
      isCaptain: boolean;
    }[];
  },
) {
  if (!guild) return;
  try {
    await syncTeamChatForTeam(guild, {
      name: team.name,
      players: team.players,
    });
    await syncTeamVoiceForTeam(guild, {
      name: team.name,
      players: team.players,
    });
  } catch (error) {
    console.warn(
      "Could not provision team Discord rooms:",
      error instanceof Error ? error.message : error,
    );
  }
}

/** Strip roster team roles and delete that franchise's chat, voice, and role. */
export async function tryTeardownTeamDiscord(
  guild: Guild | null,
  teamName: string,
  rosterDiscordIds: string[],
) {
  if (!guild) return;
  try {
    for (const discordId of rosterDiscordIds) {
      await stripMemberTeamRoles(guild, discordId);
    }
    await removeTeamVoicePresence(guild, teamName);
    await removeTeamChatPresence(guild, teamName);
  } catch (error) {
    console.warn(
      "Could not tear down team Discord rooms:",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Tournament end: wipe team text/voice rooms and cup roles
 * (Team · *, Captain, Registered, play-window). Admin role stays.
 */
export async function tryClearAllTeamDiscordRooms(guild: Guild | null): Promise<{
  text: number;
  voice: number;
  roles: number;
} | null> {
  if (!guild) return null;
  try {
    const [chat, voice] = await Promise.all([
      clearAllTeamChatChannels(guild),
      clearAllTeamVoiceChannels(guild),
    ]);
    return { text: chat.channels, voice: voice.channels, roles: chat.roles };
  } catch (error) {
    console.warn(
      "Could not clear team Discord rooms after season end:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export { clearAllTeamDiscordRoomsViaRest } from "./discord-team-cleanup-rest";

const DISCORD_API = "https://discord.com/api/v10";

async function discordBotFetch(
  method: string,
  path: string,
): Promise<Response | null> {
  const token = process.env.DISCORD_TOKEN?.trim();
  if (!token) return null;
  const res = await fetch(`${DISCORD_API}${path}`, {
    method,
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });
  if (!res.ok) void noteFailedResponse(`Discord ${method} ${path}`, res);
  return res;
}

export async function tryStripMemberTeamRoles(
  guild: Guild | null,
  discordId: string,
) {
  if (!guild) return;
  try {
    await stripMemberTeamRoles(guild, discordId);
  } catch (error) {
    console.warn(
      "Could not remove team Discord roles:",
      error instanceof Error ? error.message : error,
    );
  }
}

/** Rename Discord role/chat/voice to match a DB rename so sync does not recreate them. */
export async function tryRenameTeamDiscordLabels(
  guild: Guild | null,
  oldName: string,
  newName: string,
  captainName: string | null,
): Promise<string | null> {
  if (!guild || oldName === newName) return null;
  try {
    await renameTeamChatLabels(guild, oldName, newName);
    await renameTeamVoiceLabel(guild, oldName, newName, captainName);
    return null;
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Missing Permissions";
    console.warn("Team Discord rename:", raw);
    return `The cup name is **${newName}**, but Discord did not rename the team role/chat/voice (${raw}). Rename those Discord labels to **${newName}** manually so the private chat is not recreated. Scheduled matches are already unchanged.`;
  }
}

/** Registered + weekend roles — the same Discord access every other player gets. */
export async function tryGrantCupPlayerAccess(
  guild: Guild | null,
  discordId: string,
  playWindow?: string | null,
) {
  await trySetMemberRegisteredRole(guild, discordId, true);
  await trySetPlayWindowRoles(guild, discordId, playWindowOrBoth(playWindow));
}

export async function tryClearPlayWindowRoles(
  guild: Guild | null,
  discordId: string,
) {
  if (!guild) return;
  try {
    const member = await guild.members
      .fetch(discordId.split(":")[0])
      .catch(() => null);
    if (!member) return;
    for (const name of Object.values(PLAY_WINDOW_ROLE_NAMES)) {
      const role = findRole(guild, name);
      if (role && member.roles.cache.has(role.id)) {
        await member.roles.remove(role, "Removed from cup");
      }
    }
  } catch (error) {
    console.warn(
      "Could not clear play-window Discord roles:",
      error instanceof Error ? error.message : error,
    );
  }
}

async function tryClearPaymentRoles(guild: Guild | null, discordId: string) {
  if (!guild) return;
  try {
    const member = await guild.members
      .fetch(discordId.split(":")[0])
      .catch(() => null);
    if (!member) return;
    for (const name of [paidRoleName(), unpaidRoleName()]) {
      const role = findRole(guild, name);
      if (role && member.roles.cache.has(role.id)) {
        await member.roles.remove(role, "Removed from cup");
      }
    }
  } catch (error) {
    console.warn(
      "Could not clear payment Discord roles:",
      error instanceof Error ? error.message : error,
    );
  }
}

/** Drop registered / weekend / team roles (player delete). */
export async function tryRevokeCupPlayerAccess(
  guild: Guild | null,
  discordId: string,
) {
  await trySetMemberRegisteredRole(guild, discordId, false);
  await tryClearPlayWindowRoles(guild, discordId);
  await tryClearPaymentRoles(guild, discordId);
  try {
    await stripMemberTeamRoles(guild, discordId);
  } catch (error) {
    console.warn(
      "Could not remove team Discord roles:",
      error instanceof Error ? error.message : error,
    );
  }
}

export function describeChannelAccess() {
  return [
    `#captains — only **${captainRoleName()}** and **${adminRoleName()}** can see and chat.`,
    `#auction — only **registered** players can watch; only **${captainRoleName()}** and **${adminRoleName()}** can send messages.`,
    `#payments · #teams · #matches · #results — only **registered** players (and **${adminRoleName()}**) can see them.`,
    `Team chat — only that team's roster can see their private channel. \`/player add\` and \`/captain add\` give the team role plus registered-player access; \`/player remove\` and \`/captain remove\` take the team role off.`,
    `Team voice — only that team's roster can see their room (5 players). Their captain and **${adminRoleName()}** can drag members.`,
  ].join("\n");
}
