import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type Message,
  type PartialGuildMember,
  type TextChannel,
} from "discord.js";
import { BOT_NAME, CUP_NAME } from "./brand";
import { adminRoleName, isAdminDiscordId } from "./constants";
import { adminChannelName } from "./registration-status";

/** Prefix so we can upsert our server-side AutoMod rules. */
const AUTOMOD_PREFIX = `[${CUP_NAME}]`;

const SCAM_KEYWORDS = [
  "*free nitro*",
  "*nitro gift*",
  "*steam gift*",
  "*free steam*",
  "*claim nitro*",
  "*claim your nitro*",
  "*claim prize*",
  "*discord.gift*",
  "*airdrop*",
  "*air drop*",
  "*crypto giveaway*",
  "*steam giveaway*",
  "*cryptocurrency casino*",
  "*withdrawal success*",
  "*withdraw the bonus*",
  "*basoowin*",
  "*promo code*",
];

/** Phrases scammers often put in nicknames / display names. */
const SCAM_NICK_RE =
  /\b(nitro|steam\s*gifts?|free\s*nitro|free\s*steam|discord\.gg\/\w+|giveaway|air\s*drop|crypto|wallet|claim\s*(prize|reward)|support\s*ticket|mod(?:erator)?\s*team|official\s*support)\b/i;

/** Message body patterns that are almost always spam/scam in a cup server. */
const SCAM_MESSAGE_RE =
  /(?:discord\.gg\/\w+|https?:\/\/\S+).{0,80}\b(nitro|steam\s*gift|free\s*nitro|claim|giveaway|air\s*drop|casino|crypto)\b|\b(free\s*nitro|steam\s*gift\s*card|claim\s*your\s*(nitro|prize)|withdrawal\s*success|cryptocurrency\s*casino|basoowin|withdraw\s*the\s*bonus)\b/i;

/** True for text/link crypto-nitro scams, or @everyone/@here bait with images. */
export function looksLikeScamSpamMessage(message: Message): boolean {
  const text = message.content ?? "";
  if (SCAM_MESSAGE_RE.test(text)) return true;
  const massPing =
    message.mentions.everyone || /(^|[\s])@(?:everyone|here)\b/i.test(text);
  if (massPing && message.attachments.size > 0) return true;
  if (
    massPing &&
    /\b(casino|crypto|nitro|giveaway|bonus|withdraw|wallet|usdc|btc|eth)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  return false;
}

function findAdminRole(guild: Guild) {
  const name = adminRoleName().toLowerCase();
  return (
    guild.roles.cache.find((role) => role.name.toLowerCase() === name) ?? null
  );
}

export function isCupOrganizer(
  member: GuildMember | null | undefined,
  discordId: string,
): boolean {
  if (isAdminDiscordId(discordId)) return true;
  if (!member) return false;
  const admin = adminRoleName().toLowerCase();
  return member.roles.cache.some(
    (role) => role.name.toLowerCase() === admin,
  );
}

function looksLikeStaffImpersonation(nick: string): boolean {
  const n = nick.toLowerCase().replace(/[^a-z0-9]/g, "");
  const admin = adminRoleName().toLowerCase().replace(/[^a-z0-9]/g, "");
  const cup = CUP_NAME.toLowerCase().replace(/[^a-z0-9]/g, "");
  const bot = BOT_NAME.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!n) return false;
  if (n === admin || n.includes(admin)) return true;
  if (cup.length >= 4 && n.includes(cup)) return true;
  if (bot.length >= 4 && n.includes(bot)) return true;
  if (
    /^(admin|administrator|mod|moderator|staff|owner|support|official)$/i.test(
      nick.trim(),
    )
  ) {
    return true;
  }
  return false;
}

export function isSuspiciousDisplayName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  if (SCAM_NICK_RE.test(name)) return true;
  if (looksLikeStaffImpersonation(name)) return true;
  if (/https?:\/\//i.test(name) || /discord\.gg/i.test(name)) return true;
  return false;
}

/**
 * Strip @everyone / @here from the default role and every non-Admin role.
 * Admins (and Administrator roles) keep Mention Everyone.
 */
export async function lockMentionEveryone(guild: Guild): Promise<string> {
  await guild.roles.fetch();
  const adminRole = findAdminRole(guild);
  let stripped = 0;

  const everyone = guild.roles.everyone;
  if (everyone.permissions.has(PermissionFlagsBits.MentionEveryone)) {
    await everyone.setPermissions(
      everyone.permissions.remove(PermissionFlagsBits.MentionEveryone),
      `${CUP_NAME}: only staff may @everyone`,
    );
    stripped += 1;
  }

  for (const role of guild.roles.cache.values()) {
    if (role.id === everyone.id) continue;
    if (adminRole && role.id === adminRole.id) continue;
    if (role.managed) continue;
    if (role.permissions.has(PermissionFlagsBits.Administrator)) continue;
    if (!role.permissions.has(PermissionFlagsBits.MentionEveryone)) continue;
    try {
      await role.setPermissions(
        role.permissions.remove(PermissionFlagsBits.MentionEveryone),
        `${CUP_NAME}: only staff may @everyone`,
      );
      stripped += 1;
    } catch (error) {
      console.warn(
        `Could not strip Mention Everyone from ${role.name}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (adminRole && !adminRole.permissions.has(PermissionFlagsBits.MentionEveryone)) {
    try {
      await adminRole.setPermissions(
        adminRole.permissions.add(PermissionFlagsBits.MentionEveryone),
        `${CUP_NAME}: Admin may @everyone`,
      );
    } catch (error) {
      console.warn(
        `Could not grant Mention Everyone to ${adminRole.name}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return stripped > 0
    ? `stripped Mention Everyone from ${stripped} role${stripped === 1 ? "" : "s"}`
    : "Mention Everyone already locked to staff";
}

/**
 * Discord AutoMod rules live on the server — they keep blocking spam even when
 * our bot process is offline. Role Mention Everyone lock is also native.
 */
export async function ensureDiscordNativeAntiSpam(guild: Guild): Promise<string> {
  await guild.roles.fetch();
  const adminRole = findAdminRole(guild);
  const alertChannel = await findAdminTextChannel(guild);
  const exemptRoles = adminRole ? [adminRole] : [];

  const rules = await guild.autoModerationRules.fetch();
  const upsert = async (opts: {
    name: string;
    eventType: AutoModerationRuleEventType;
    triggerType: AutoModerationRuleTriggerType;
    /** Some trigger types allow only one rule per guild. */
    uniqueByTrigger?: boolean;
    triggerMetadata?: {
      keywordFilter?: string[];
      mentionTotalLimit?: number;
      mentionRaidProtectionEnabled?: boolean;
    };
    actions: {
      type: AutoModerationActionType;
      metadata?: { channel?: TextChannel; customMessage?: string };
    }[];
  }) => {
    const fullName = `${AUTOMOD_PREFIX} ${opts.name}`;
    const existing =
      rules.find((r) => r.name === fullName) ??
      (opts.uniqueByTrigger
        ? rules.find((r) => r.triggerType === opts.triggerType)
        : undefined);
    const payload = {
      name: fullName,
      eventType: opts.eventType,
      triggerType: opts.triggerType,
      triggerMetadata: opts.triggerMetadata,
      actions: opts.actions,
      enabled: true,
      exemptRoles,
      reason: `${CUP_NAME} offline-safe anti-spam`,
    };
    if (existing) {
      await existing.edit({
        name: fullName,
        eventType: payload.eventType,
        triggerMetadata: payload.triggerMetadata,
        actions: payload.actions,
        enabled: true,
        exemptRoles,
        reason: payload.reason,
      });
      return "updated";
    }
    const created = await guild.autoModerationRules.create(payload);
    rules.set(created.id, created);
    return "created";
  };

  const blockMessage = (customMessage: string) => {
    const actions: {
      type: AutoModerationActionType;
      metadata?: { channel?: TextChannel; customMessage?: string };
    }[] = [
      {
        type: AutoModerationActionType.BlockMessage,
        metadata: { customMessage },
      },
    ];
    if (alertChannel) {
      actions.push({
        type: AutoModerationActionType.SendAlertMessage,
        metadata: { channel: alertChannel },
      });
    }
    return actions;
  };

  const parts: string[] = [];
  const tryRule = async (label: string, run: () => Promise<string>) => {
    try {
      parts.push(`${label} ${await run()}`);
    } catch (error) {
      parts.push(
        `${label} failed (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  };

  await tryRule("scam-messages", () =>
    upsert({
      name: "block scam invite posts",
      eventType: AutoModerationRuleEventType.MessageSend,
      triggerType: AutoModerationRuleTriggerType.Keyword,
      triggerMetadata: { keywordFilter: SCAM_KEYWORDS },
      actions: blockMessage(
        "That looked like a scam/spam post. Only staff can post invite giveaways.",
      ),
    }),
  );

  await tryRule("mention-spam", () =>
    upsert({
      name: "block mention spam",
      eventType: AutoModerationRuleEventType.MessageSend,
      triggerType: AutoModerationRuleTriggerType.MentionSpam,
      uniqueByTrigger: true,
      triggerMetadata: {
        mentionTotalLimit: 5,
        mentionRaidProtectionEnabled: true,
      },
      actions: blockMessage(
        "Too many mentions. Ping specific people — only Admin can @everyone.",
      ),
    }),
  );

  // Drop nick-profile AutoMod if present (not supported on this guild).
  for (const rule of rules.values()) {
    if (rule.triggerType !== AutoModerationRuleTriggerType.MemberProfile) {
      continue;
    }
    try {
      await rule.delete(`${CUP_NAME}: nick AutoMod unavailable`);
      parts.push(`removed ${rule.name}`);
    } catch {
      /* ignore */
    }
  }

  return parts.join("; ") || "no AutoMod changes";
}

/** Role lock + Discord AutoMod (both work with the bot offline). */
export async function ensureDiscordAntiSpam(guild: Guild): Promise<string> {
  const mention = await lockMentionEveryone(guild);
  let automod = "AutoMod skipped";
  try {
    automod = await ensureDiscordNativeAntiSpam(guild);
  } catch (error) {
    automod = `AutoMod failed: ${
      error instanceof Error ? error.message : String(error)
    } (bot needs Manage Server)`;
  }
  return `${mention}. ${automod}`;
}

function mentionsEveryoneOrHere(message: Message): boolean {
  if (message.mentions.everyone) return true;
  const raw = message.content ?? "";
  return /(^|[\s])@(?:everyone|here)\b/i.test(raw);
}

/** Delete non-admin messages that ping @everyone / @here. */
export async function moderateEveryoneMentions(
  message: Message,
): Promise<boolean> {
  if (message.author.bot) return false;
  if (!message.guild) return false;
  if (message.channel.type !== ChannelType.GuildText) return false;
  if (!mentionsEveryoneOrHere(message)) return false;
  if (isCupOrganizer(message.member, message.author.id)) return false;

  try {
    await message.delete();
  } catch (error) {
    console.warn(
      "Could not delete @everyone spam (need Manage Messages):",
      error instanceof Error ? error.message : error,
    );
    return false;
  }

  try {
    const notice = await message.channel.send({
      content:
        `<@${message.author.id}> Only **${adminRoleName()}** can ping @everyone / @here. ` +
        `Mention specific people instead.`,
    });
    setTimeout(() => notice.delete().catch(() => {}), 12_000);
  } catch {
    /* ignore */
  }

  await alertAdmins(
    message.guild,
    `Blocked @everyone/@here from <@${message.author.id}> (\`${message.author.tag}\`) in <#${message.channel.id}>.`,
  );

  return true;
}

/** Delete common nitro/gift / crypto-casino scam posts from non-admins. */
export async function moderateScamSpamMessage(
  message: Message,
): Promise<boolean> {
  if (message.author.bot) return false;
  if (!message.guild) return false;
  if (message.channel.type !== ChannelType.GuildText) return false;
  if (isCupOrganizer(message.member, message.author.id)) return false;
  if (!looksLikeScamSpamMessage(message)) return false;

  try {
    await message.delete();
  } catch (error) {
    console.warn(
      "Could not delete scam spam (need Manage Messages):",
      error instanceof Error ? error.message : error,
    );
    return false;
  }

  try {
    const notice = await message.channel.send({
      content:
        `<@${message.author.id}> That message looked like a scam/spam post and was removed. ` +
        `If this was a mistake, ping an **${adminRoleName()}**.`,
    });
    setTimeout(() => notice.delete().catch(() => {}), 12_000);
  } catch {
    /* ignore */
  }

  await alertAdmins(
    message.guild,
    `Removed suspected scam post from <@${message.author.id}> (\`${message.author.tag}\`) in <#${message.channel.id}>.`,
  );

  return true;
}

async function findAdminTextChannel(guild: Guild): Promise<TextChannel | null> {
  await guild.channels.fetch().catch(() => undefined);
  const name = adminChannelName().toLowerCase();
  const found = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildText && ch.name.toLowerCase() === name,
  );
  return found?.type === ChannelType.GuildText ? found : null;
}

async function alertAdmins(guild: Guild, content: string) {
  try {
    const channel = await findAdminTextChannel(guild);
    if (!channel) return;
    await channel.send({ content: `🛡️ ${content}` });
  } catch {
    /* #admin may be missing */
  }
}

/**
 * Reset scam / staff-impersonation nicknames and ping #admin.
 * Needs GuildMembers intent + Manage Nicknames.
 */
export async function handleSuspiciousNickChange(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember,
): Promise<boolean> {
  if (newMember.user.bot) return false;
  if (isCupOrganizer(newMember, newMember.id)) return false;

  const oldNick =
    "nickname" in oldMember ? (oldMember.nickname ?? null) : null;
  const newNick = newMember.nickname;
  if (oldNick === newNick) return false;
  if (!newNick) return false;
  if (!isSuspiciousDisplayName(newNick)) return false;

  const revertTo = oldNick;
  let reverted = false;
  try {
    await newMember.setNickname(
      revertTo,
      `${CUP_NAME}: blocked suspicious nickname`,
    );
    reverted = true;
  } catch (error) {
    console.warn(
      `Could not reset nickname for ${newMember.user.tag} (need Manage Nicknames + role hierarchy):`,
      error instanceof Error ? error.message : error,
    );
  }

  await alertAdmins(
    newMember.guild,
    [
      `Suspicious nickname change by <@${newMember.id}> (\`${newMember.user.tag}\`).`,
      `Tried to set nick to **${newNick}**.`,
      reverted
        ? `Reverted to ${revertTo ? `**${revertTo}**` : "no nick"}.`
        : `Could not revert (check bot **Manage Nicknames** + role order).`,
    ].join(" "),
  );

  return true;
}
