import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
  type Message,
  type TextChannel,
} from "discord.js";
import { adminRoleName } from "./constants";
import { fullHelpText, splitDiscordChunks } from "./help";
import { lockPaymentsChannel, lockRegisteredPlayerChannels } from "./payments-channel-access";
import { rulesChannelName } from "./rules";
import { syncTeamVoiceChannels } from "./team-voice";
import { dummyAuctionChannelName, ensureDummyAuctionChannel } from "./dummy-auction-channel";
import {
  formatEntryFee,
  formatTeamFee,
  paymentAccountName,
  paymentAccountNumber,
  paymentBankName,
  paymentIban,
  paymentsChannelName,
} from "./registration-status";

const GOLD = 0xb07d1f;

/** Manage Channels + Messages + Roles + send/view/react so the bot can create #payments. */
export const BOT_INVITE_PERMISSIONS = String(
  PermissionFlagsBits.ManageChannels |
    PermissionFlagsBits.ManageRoles |
    PermissionFlagsBits.ManageMessages |
    PermissionFlagsBits.ViewChannel |
    PermissionFlagsBits.SendMessages |
    PermissionFlagsBits.EmbedLinks |
    PermissionFlagsBits.AttachFiles |
    PermissionFlagsBits.ReadMessageHistory |
    PermissionFlagsBits.AddReactions |
    PermissionFlagsBits.UseApplicationCommands |
    PermissionFlagsBits.Connect |
    PermissionFlagsBits.Speak |
    PermissionFlagsBits.MoveMembers |
    PermissionFlagsBits.MuteMembers |
    PermissionFlagsBits.ManageGuild,
);

export function botInviteUrl(clientId: string) {
  return `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${BOT_INVITE_PERMISSIONS}&scope=bot%20applications.commands`;
}

export function adminChannelName() {
  return process.env.ADMIN_CHANNEL_NAME?.trim() || "admin";
}

function findTextChannel(guild: Guild, name: string): TextChannel | null {
  const found = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildText &&
      ch.name.toLowerCase() === name.toLowerCase(),
  );
  return found?.type === ChannelType.GuildText ? found : null;
}

function findNamedTextChannel(guild: Guild, names: string[]): TextChannel | null {
  for (const name of names) {
    const found = findTextChannel(guild, name);
    if (found) return found;
  }
  return null;
}

export function registrationClosedEmbed() {
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle("Registration is closed")
    .setDescription(
      [
        "Public registration for **MM Dota Cup** is now **closed**.",
        "If you have already registered, you are in the pool.",
        "",
        `The entry fee is **${formatEntryFee()} per person**.`,
        `Send a **clear payment screenshot** in **#${paymentsChannelName()}**. An **Admin** will click ✅ to confirm. You are not marked as paid until then.`,
        `Substitutes do **not** pay. Each team must collect **exactly ${formatTeamFee()}** (five starters).`,
        "",
        "Need a late add or a removal? Ping an **Admin**.",
      ].join("\n"),
    )
    .setFooter({ text: "MM Dota Cup · Admins: /player register · /player delete" });
}

export function paymentsChannelEmbed() {
  const channel = paymentsChannelName();
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle(`#${channel} — payment rules`)
    .setDescription(
      [
        "This channel is **only visible to registered cup players** and staff.",
        "This channel is for **payment screenshots only**. Read these rules before you post.",
        "",
        "**Pay here**",
        `**${paymentBankName()}**`,
        `Account number: \`${paymentAccountNumber()}\``,
        `IBAN: \`${paymentIban()}\``,
        `Account title: **${paymentAccountName()}**`,
        "",
        "**Rules**",
        `1. The entry fee is **${formatEntryFee()} per person**.`,
        `2. Send **1000 PKR** to the **${paymentBankName()}** account above, then upload a **clear screenshot** — nothing else.`,
        "3. Do **not** chat, ask questions, or post memes here. Use **#general** for that.",
        "4. An **Admin** will click ✅ on your screenshot to confirm. You are **not paid** until that happens.",
        "5. Your screenshot stays in Discord. We do not save the image anywhere else.",
        "6. **Substitutes do not pay.**",
        `7. A team is allowed only at **exactly ${formatTeamFee()}** — five starters. That amount is both the minimum and the maximum.`,
      ].join("\n"),
    )
    .addFields(
      { name: "Bank / method", value: paymentBankName(), inline: true },
      { name: "Account number", value: `\`${paymentAccountNumber()}\``, inline: true },
      { name: "Account title", value: paymentAccountName(), inline: true },
      { name: "IBAN", value: `\`${paymentIban()}\``, inline: false },
    )
    .setFooter({ text: "Staff may talk here. Everyone else: screenshot only." });
}

function isPaymentAnnouncementMessage(message: Message, botUserId: string) {
  if (message.author.id !== botUserId) return false;
  const title = message.embeds[0]?.title?.trim().toLowerCase() ?? "";
  return (
    title.includes("payment rules") ||
    title.includes("payment screenshots") ||
    /^#payments?\b/.test(title)
  );
}

/** Update the pinned #payments announcement in place so account details show without duplicates. */
export async function refreshPinnedPaymentAnnouncement(
  guild: Guild,
  botUserId?: string,
) {
  if (!botUserId) return;
  await guild.channels.fetch();
  const payments = findNamedTextChannel(guild, [
    paymentsChannelName(),
    "payment",
    "payments",
  ]);
  if (!payments) return;

  const embed = paymentsChannelEmbed();
  try {
    const { items } = await payments.messages.fetchPins();
    let updated = 0;
    for (const pin of items) {
      const msg = pin.message;
      if (!isPaymentAnnouncementMessage(msg, botUserId)) continue;
      await msg.edit({ embeds: [embed] });
      updated += 1;
    }
    if (updated > 0) {
      console.log(`Updated ${updated} pinned payment announcement(s) in #${payments.name}`);
      return;
    }
  } catch (error) {
    console.warn(
      "Could not read #payments pins:",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    const sent = await payments.send({ embeds: [embed] });
    await sent.pin().catch(() => undefined);
    console.log(`Posted payment announcement in #${payments.name}`);
  } catch (error) {
    console.warn(
      "Could not post #payments announcement:",
      error instanceof Error ? error.message : error,
    );
  }
}

export function indoorLeagueEmbed() {
  return new EmbedBuilder()
    .setColor(GOLD)
    .setTitle("Indoor tournament — MM players only")
    .setDescription(
      [
        "This is an **indoor tournament** for the **MM Discord**.",
        "Only players who have **played with MM** — regularly or from time to time — may take part.",
        "",
        "**Outdoor / outside members are not allowed.**",
        "After this league ends, we will arrange a separate outdoor tournament.",
      ].join("\n"),
    )
    .setFooter({ text: "MM Dota Cup · MM community only" });
}

function isCupAnnouncementMessage(message: Message, botUserId: string) {
  if (message.author.id !== botUserId) return false;
  const title = message.embeds[0]?.title?.trim().toLowerCase() ?? "";
  if (!title) return false;
  return (
    title === "registration is closed" ||
    title.startsWith("indoor tournament") ||
    title === "indoor mm discord league" ||
    title.includes("payment rules") ||
    title.includes("payment screenshots") ||
    /^#payments?\b/.test(title)
  );
}

async function deleteAnnouncementMessages(
  channel: TextChannel,
  botUserId: string,
) {
  let removed = 0;
  try {
    const { items } = await channel.messages.fetchPins();
    for (const pin of items) {
      const msg = pin.message;
      if (!isCupAnnouncementMessage(msg, botUserId)) continue;
      try {
        await msg.unpin().catch(() => undefined);
        await msg.delete();
        removed += 1;
      } catch {
        /* skip */
      }
    }
  } catch {
    /* cannot read pins */
  }

  let before: string | undefined;
  for (let page = 0; page < 12; page += 1) {
    const batch = await channel.messages.fetch(
      before ? { limit: 100, before } : { limit: 100 },
    );
    if (batch.size === 0) break;
    before = batch.last()?.id;
    for (const msg of batch.values()) {
      if (!isCupAnnouncementMessage(msg, botUserId)) continue;
      try {
        await msg.delete();
        removed += 1;
      } catch {
        /* skip */
      }
    }
    if (batch.size < 100) break;
  }
  return removed;
}

export async function clearCupAnnouncements(
  guild: Guild,
  botUserId: string,
): Promise<SetupResult[]> {
  await guild.channels.fetch();
  const results: SetupResult[] = [];
  for (const channel of guild.channels.cache.values()) {
    if (channel.type !== ChannelType.GuildText) continue;
    try {
      const removed = await deleteAnnouncementMessages(channel, botUserId);
      if (removed > 0) {
        results.push({
          channel: channel.name,
          ok: true,
          detail: `removed ${removed} old announcement(s)`,
        });
      }
    } catch (error) {
      results.push({
        channel: channel.name,
        ok: false,
        detail:
          error instanceof Error
            ? error.message
            : "Could not delete messages (need Manage Messages)",
      });
    }
  }
  if (results.length === 0) {
    results.push({
      channel: "announcements",
      ok: true,
      detail: "no old announcement embeds found",
    });
  }
  return results;
}

export async function ensurePaymentsChannel(guild: Guild): Promise<TextChannel> {
  await guild.channels.fetch();
  const name = paymentsChannelName();
  const existing = findNamedTextChannel(guild, [name, "payment", "payments"]);
  if (existing) {
    try {
      await lockPaymentsChannel(existing, guild);
    } catch (error) {
      console.warn(
        `Could not lock #${existing.name} to registered players:`,
        error instanceof Error ? error.message : error,
      );
    }
    return existing;
  }

  const created = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    topic: `MM Dota Cup — screenshot of ${formatEntryFee()}; Admin clicks ✅ to confirm`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
    ],
    reason: "MM Dota Cup payment proof channel",
  });
  try {
    await lockPaymentsChannel(created, guild);
  } catch (error) {
    console.warn(
      `Could not lock #${created.name} to registered players:`,
      error instanceof Error ? error.message : error,
    );
  }
  return created;
}

export function describeDiscordChannelError(
  error: unknown,
  channelName: string,
) {
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  const raw =
    error instanceof Error ? error.message : "Could not use that channel";

  if (code === 50001 || /missing access/i.test(raw)) {
    return (
      `**#${channelName}** is private — the bot is not allowed in it. ` +
      `Open **#${channelName}** → Edit Channel → Permissions → Add **dota2-cup** ` +
      `(or the bot's role) → enable **View Channel**, **Send Messages**, and **Read Message History**. ` +
      `Then run \`/admin setup\` again.`
    );
  }
  if (code === 50013 || /missing permissions/i.test(raw)) {
    return (
      `The bot needs **Manage Channels** to change **#${channelName}**. ` +
      `Add the bot on that channel's permission list (View + Send + Read History), ` +
      `or re-invite it with Manage Channels.`
    );
  }
  return raw;
}

async function allowBotInChannel(channel: TextChannel, guild: Guild) {
  const botMember = guild.members.me;
  if (!botMember) return;
  await channel.permissionOverwrites.edit(botMember, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    EmbedLinks: true,
    AttachFiles: true,
    ManageMessages: true,
    AddReactions: true,
  });
  const adminRole = guild.roles.cache.find(
    (role) => role.name.toLowerCase() === adminRoleName().toLowerCase(),
  );
  if (adminRole) {
    await channel.permissionOverwrites.edit(adminRole, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      EmbedLinks: true,
      AttachFiles: true,
      ManageMessages: true,
    });
  }
}

export async function ensureAdminChannel(guild: Guild): Promise<TextChannel> {
  await guild.channels.fetch();
  await guild.roles.fetch();
  const name = adminChannelName();
  const existing = findNamedTextChannel(guild, [name, "admins"]);
  if (existing) {
    try {
      await allowBotInChannel(existing, guild);
    } catch (error) {
      console.warn(
        `Could not add the bot to #${existing.name}:`,
        error instanceof Error ? error.message : error,
      );
    }
    return existing;
  }

  const adminRole = guild.roles.cache.find(
    (role) => role.name.toLowerCase() === adminRoleName().toLowerCase(),
  );
  const botMember = guild.members.me;
  const overwrites: {
    id: string;
    allow?: bigint[];
    deny?: bigint[];
  }[] = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
  ];
  if (adminRole) {
    overwrites.push({
      id: adminRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }
  if (botMember) {
    overwrites.push({
      id: botMember.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    topic: "MM Dota Cup — admin commands and help",
    permissionOverwrites: overwrites,
    reason: "MM Dota Cup admin channel",
  });
}

async function alreadyPinnedHelp(channel: TextChannel, botUserId: string) {
  try {
    const { items } = await channel.messages.fetchPins();
    return items.some(
      (pin) =>
        pin.message.author.id === botUserId &&
        pin.message.content.startsWith("**Anyone**"),
    );
  } catch {
    return false;
  }
}

export async function postAdminCommandHelp(
  channel: TextChannel,
  options?: { force?: boolean; botUserId?: string },
): Promise<{ posted: number; skipped: boolean }> {
  if (
    !options?.force &&
    options?.botUserId &&
    (await alreadyPinnedHelp(channel, options.botUserId))
  ) {
    return { posted: 0, skipped: true };
  }

  const chunks = splitDiscordChunks(fullHelpText());
  for (const [index, chunk] of chunks.entries()) {
    const sent = await channel.send({
      content: chunk,
      allowedMentions: { parse: [] },
    });
    if (index === 0) {
      try {
        await sent.pin();
      } catch {
        /* pin optional */
      }
    }
  }
  return { posted: chunks.length, skipped: false };
}

export type SetupResult = { channel: string; ok: boolean; detail: string };

export async function setupCupDiscord(
  guild: Guild,
  options?: { botUserId?: string; announce?: boolean; forceHelp?: boolean },
): Promise<SetupResult[]> {
  const results: SetupResult[] = [];

  try {
    const payments = await ensurePaymentsChannel(guild);
    results.push({
      channel: payments.name,
      ok: true,
      detail: `registered players only — ${payments}`,
    });
  } catch (error) {
    results.push({
      channel: paymentsChannelName(),
      ok: false,
      detail:
        error instanceof Error
          ? `${error.message} — the bot needs **Manage Channels**. Re-invite it or create #${paymentsChannelName()} yourself.`
          : "Could not create #payments (need Manage Channels)",
    });
  }

  try {
    await lockRegisteredPlayerChannels(guild);
    results.push({
      channel: "teams / results / auction",
      ok: true,
      detail: "registered players only",
    });
  } catch (error) {
    results.push({
      channel: "teams / results / auction",
      ok: false,
      detail:
        error instanceof Error
          ? error.message
          : "Could not lock those channels (need Manage Channels)",
    });
  }

  try {
    const voice = await syncTeamVoiceChannels(guild);
    results.push(...voice);
  } catch (error) {
    results.push({
      channel: "team voice",
      ok: false,
      detail:
        error instanceof Error
          ? error.message
          : "Could not create team voice channels",
    });
  }

  try {
    const testAuction = await ensureDummyAuctionChannel(guild, {
      botUserId: options?.botUserId,
    });
    results.push({
      channel: testAuction.name,
      ok: true,
      detail: `Admin-only test auction — ${testAuction}`,
    });
  } catch (error) {
    results.push({
      channel: dummyAuctionChannelName(),
      ok: false,
      detail:
        error instanceof Error
          ? `${error.message} — the bot needs **Manage Channels** to create #${dummyAuctionChannelName()}.`
          : `Could not create #${dummyAuctionChannelName()} (need Manage Channels)`,
    });
  }

  try {
    const admin = await ensureAdminChannel(guild);
    const help = await postAdminCommandHelp(admin, {
      force: options?.forceHelp ?? false,
      botUserId: options?.botUserId,
    });
    results.push({
      channel: admin.name,
      ok: true,
      detail: help.skipped
        ? `help already pinned — ${admin}`
        : `posted command help — ${admin}`,
    });
  } catch (error) {
    results.push({
      channel: adminChannelName(),
      ok: false,
      detail: describeDiscordChannelError(error, adminChannelName()),
    });
  }

  if (options?.announce !== false) {
    results.push(...(await postCupAnnouncements(guild, { skipEnsurePayments: true })));
  }

  return results;
}

export async function postCupAnnouncements(
  guild: Guild,
  options?: { skipEnsurePayments?: boolean },
): Promise<SetupResult[]> {
  const results: SetupResult[] = [];

  let payments: TextChannel | null = null;
  if (!options?.skipEnsurePayments) {
    try {
      payments = await ensurePaymentsChannel(guild);
      results.push({
        channel: payments.name,
        ok: true,
        detail: `registered players only — ${payments}`,
      });
    } catch (error) {
      results.push({
        channel: paymentsChannelName(),
        ok: false,
        detail:
          error instanceof Error
            ? error.message
            : "Could not create #payments (need Manage Channels)",
      });
    }
  } else {
    payments = findNamedTextChannel(guild, [
      paymentsChannelName(),
      "payment",
      "payments",
    ]);
  }

  const generalName = rulesChannelName();
  const general = findTextChannel(guild, generalName);
  if (!general) {
    results.push({
      channel: generalName,
      ok: false,
      detail: `#${generalName} not found — ${payments ? "payments channel is still ready" : "create #payments manually"}`,
    });
    if (payments) {
      try {
        const sent = await payments.send({ embeds: [paymentsChannelEmbed()] });
        try {
          await sent.pin();
        } catch {
          /* pin optional */
        }
        results.push({
          channel: payments.name,
          ok: true,
          detail: `posted payment instructions — ${payments}`,
        });
      } catch (error) {
        results.push({
          channel: payments.name,
          ok: false,
          detail: error instanceof Error ? error.message : "send failed",
        });
      }
    }
    return results;
  }

  if (!payments) {
    try {
      payments = await ensurePaymentsChannel(guild);
    } catch {
      payments = null;
    }
  }

  const posts: { channel: TextChannel; embed: EmbedBuilder; pin: boolean }[] = [
    { channel: general, embed: registrationClosedEmbed(), pin: true },
    { channel: general, embed: indoorLeagueEmbed(), pin: true },
  ];
  if (payments) {
    posts.push({ channel: payments, embed: paymentsChannelEmbed(), pin: true });
  }

  for (const post of posts) {
    try {
      const sent = await post.channel.send({ embeds: [post.embed] });
      if (post.pin) {
        try {
          await sent.pin();
        } catch {
          results.push({
            channel: post.channel.name,
            ok: true,
            detail: `posted "${post.embed.data.title}" (could not pin)`,
          });
          continue;
        }
      }
      results.push({
        channel: post.channel.name,
        ok: true,
        detail: `posted "${post.embed.data.title}"`,
      });
    } catch (error) {
      results.push({
        channel: post.channel.name,
        ok: false,
        detail: error instanceof Error ? error.message : "send failed",
      });
    }
  }

  return results;
}
