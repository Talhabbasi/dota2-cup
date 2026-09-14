import {
  ChannelType,
  type Guild,
  type GuildMember,
  type Role,
  type TextChannel,
} from "discord.js";
import { adminRoleName } from "./constants";
import { ensureMatchesChannel, ensurePaymentsChannel } from "./cup-announcements";
import {
  lockRegisteredPlayerChannels,
  trySetMemberRegisteredRole,
} from "./payments-channel-access";
import { ensureDummyAuctionChannel } from "./dummy-auction-channel";
import { stripMemberTeamRoles, syncTeamChatChannels } from "./team-chat";
import { syncTeamVoiceChannels } from "./team-voice";
import {
  PLAY_WINDOW_ROLE_NAMES,
  playWindowOrBoth,
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
      reason: "MM Dota Cup captain role",
    });
  } catch {
    throw new Error(
      `The bot cannot create the **${name}** Discord role (needs **Manage Roles**). ` +
        `Server Settings → Roles → enable **Manage Roles** on **dota2-cup**, ` +
        `and drag the bot role **above** ${name}. Or create a role named **${name}** yourself.`,
    );
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

export async function syncCupChannelAccess(guild: Guild) {
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
    await lockRegisteredPlayerChannels(guild);
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

export async function syncCaptainRolesFromDb(guild: Guild) {
  let role: Role;
  try {
    role = await ensureCaptainRole(guild);
  } catch (error) {
    console.warn(
      "Could not sync Captain Discord roles:",
      error instanceof Error ? error.message : error,
    );
    return;
  }
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

/** Drop registered / weekend / team roles (player delete). */
export async function tryRevokeCupPlayerAccess(
  guild: Guild | null,
  discordId: string,
) {
  await trySetMemberRegisteredRole(guild, discordId, false);
  await tryClearPlayWindowRoles(guild, discordId);
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
