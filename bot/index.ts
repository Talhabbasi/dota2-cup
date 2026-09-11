import "./load-env";

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
  type Interaction,
  type Message,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type TextChannel,
  type User,
} from "discord.js";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  adminRoleName,
  BID_INCREMENT,
  FLEX,
  MAX_ROSTER,
  isAdminDiscordId,
  MEDAL_LABELS,
  MEDALS,
  ROLE_LABELS,
  ROLES,
  STARTING_ROLES,
  STARTING_PURSE,
  basePriceFor,
  type Medal,
  type Role,
} from "../src/lib/constants";
import { registerPlayer, setPlayerPlayWindow } from "../src/lib/register";
import {
  formatEntryFee,
  isPaymentsChannelName,
  isRegistrationOpen,
  paymentAccountNumber,
  paymentsChannelName,
  registrationClosedDiscordReply,
  setRegistrationOpen,
} from "../src/lib/registration-status";
import {
  adminChannelName,
  botInviteUrl,
  describeDiscordChannelError,
  ensureAdminChannel,
  postAdminCommandHelp,
  postCupAnnouncements,
  setupCupDiscord,
  clearCupAnnouncements,
} from "../src/lib/cup-announcements";
import {
  messageHasImage,
  moderateCommandOnlyChannel,
  moderatePaymentsChannel,
} from "../src/lib/channel-moderation";
import {
  adminAddCaptain,
  adminRemoveCaptain,
  getTeamByCaptainDiscord,
  rosterSummary,
} from "../src/lib/captains";
import {
  clearAuctionMessage,
  getAuctionView,
  markAuctionAnnounced,
  patchLivePlayer,
  pauseAuction,
  placeBid,
  saveAuctionMessage,
  skipLot,
  startAuction,
  tickAuction,
  undoLastSale,
  hydrateAuctionClock,
} from "../src/lib/auction";
import { notifySiteRefresh } from "../src/lib/notify-site";
import {
  adminMarkPaid,
  findTeamPaymentsByName,
  formatTeamPaymentDetail,
  formatTeamPaymentLine,
  formatTeamPaymentsList,
  formatUnpaidList,
  listTeamPayments,
  listUnpaidPlayers,
  playerMustPay,
  recordPlayerPayment,
} from "../src/lib/payments";
import { assignUnknown, ingestMatch } from "../src/lib/results";
import {
  clearScheduledFixtures,
  formatScheduleSummary,
  formatScheduleWhen,
  generateGrandFinal,
  generateWeekendSchedule,
  listScheduledFixtures,
} from "../src/lib/schedule";
import { fullHelpText, splitDiscordChunks } from "../src/lib/help";
import { tickMatchReminders } from "../src/lib/reminders";
import {
  buildRulesEmbed,
  registerChannelName,
  rulesChannelName,
} from "../src/lib/rules";
import {
  autoPostChannelRulesEnabled,
  formatGuideResults,
  postChannelGuides,
} from "../src/lib/post-channel-guides";
import {
  describeChannelAccess,
  syncCaptainRolesFromDb,
  syncCupChannelAccess,
  trySetMemberCaptainRole,
  trySetPlayWindowRoles,
} from "../src/lib/discord-access";
import {
  adminAddPlayerToTeam,
  adminClearDummyPlayers,
  adminClearDummyTeams,
  adminCreateDummyPlayers,
  adminCreateDummyTeams,
  adminDeletePlayer,
  adminRemovePlayerFromTeam,
  adminResyncRosterRole,
  adminUpdatePlayerProfile,
  formatPlayerDirectory,
  listRegisteredPlayers,
} from "../src/lib/players-admin";
import { parseRolesJson } from "../src/lib/roles";
import { prisma } from "../src/lib/prisma";
import { formatRoles } from "../src/lib/data";
import { publicErrorMessage } from "../src/lib/public-error";
import { steamProfileUrl } from "../src/lib/steam";
import {
  PLAY_WINDOW_DISCORD_CHOICES,
  PLAY_WINDOW_LABELS,
  PLAY_WINDOW_SHORT,
  playWindowOrBoth,
} from "../src/lib/play-window";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error("Set DISCORD_TOKEN and DISCORD_CLIENT_ID in .env");
  process.exit(1);
}

const botToken: string = token;
const botClientId: string = clientId;

const medalChoices = MEDALS.map((m) => ({
  name: MEDAL_LABELS[m],
  value: m,
}));
const roleChoices = ROLES.map((r) => ({
  name: ROLE_LABELS[r],
  value: r,
}));
const registerRoleChoices = [
  ...STARTING_ROLES.map((r) => ({
    name: ROLE_LABELS[r],
    value: r,
  })),
  { name: ROLE_LABELS[FLEX], value: FLEX },
  { name: ROLE_LABELS.sub, value: "sub" },
];

const commands = [
  new SlashCommandBuilder()
    .setName("register")
    .setDescription("Link one Steam account to this Discord (one per person)")
    .addStringOption((o) =>
      o
        .setName("steam")
        .setDescription("Full Steam profile URL (Share → Copy Page URL)")
        .setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName("rank")
        .setDescription("Your medal")
        .setRequired(true)
        .addChoices(...medalChoices),
    )
    .addStringOption((o) =>
      o
        .setName("role")
        .setDescription("Your main role — pick from the dropdown")
        .setRequired(true)
        .addChoices(...registerRoleChoices),
    )
    .addStringOption((o) =>
      o
        .setName("when")
        .setDescription("Weekend availability (Pakistan time)")
        .setRequired(true)
        .addChoices(...PLAY_WINDOW_DISCORD_CHOICES),
    ),
  new SlashCommandBuilder()
    .setName("me")
    .setDescription("Show your registration and team"),
  new SlashCommandBuilder()
    .setName("when")
    .setDescription("Set when you can play on weekends (Pakistan time)")
    .addStringOption((o) =>
      o
        .setName("window")
        .setDescription("When you can play on weekends (Pakistan time)")
        .setRequired(true)
        .addChoices(...PLAY_WINDOW_DISCORD_CHOICES),
    ),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Commands and how to run the cup"),
  new SlashCommandBuilder()
    .setName("captain")
    .setDescription("Admin: appoint or remove a franchise captain")
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Admin: appoint a captain")
        .addUserOption((o) =>
          o.setName("user").setDescription("Player").setRequired(true),
        )
        .addStringOption((o) =>
          o.setName("team").setDescription("Team name").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Admin: remove a captain and release the roster")
        .addUserOption((o) =>
          o.setName("user").setDescription("Captain").setRequired(true),
        ),
    ),
  new SlashCommandBuilder()
    .setName("player")
    .setDescription("Admin: manage registered players")
    .addSubcommand((s) =>
      s.setName("list").setDescription("Admin: list every registered player"),
    )
    .addSubcommand((s) =>
      s
        .setName("register")
        .setDescription("Admin: add a player after public registration closed")
        .addUserOption((o) =>
          o.setName("user").setDescription("Discord user").setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("steam")
            .setDescription("Full Steam profile URL")
            .setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("rank")
            .setDescription("Medal")
            .setRequired(true)
            .addChoices(...medalChoices),
        )
        .addStringOption((o) =>
          o
            .setName("role")
            .setDescription("Main role")
            .setRequired(true)
            .addChoices(...registerRoleChoices),
        )
        .addStringOption((o) =>
          o
            .setName("when")
            .setDescription("Weekend availability")
            .setRequired(true)
            .addChoices(...PLAY_WINDOW_DISCORD_CHOICES),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("delete")
        .setDescription("Admin: delete a player from the cup (also off their team)")
        .addUserOption((o) =>
          o.setName("user").setDescription("Player").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Admin: add a registered player to a team")
        .addUserOption((o) =>
          o.setName("user").setDescription("Player").setRequired(true),
        )
        .addStringOption((o) =>
          o.setName("team").setDescription("Team name").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Admin: remove a player from their team")
        .addUserOption((o) =>
          o.setName("user").setDescription("Player").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("resync")
        .setDescription("Admin: fix roster slot from their /register role")
        .addUserOption((o) =>
          o.setName("user").setDescription("Player").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("edit")
        .setDescription("Admin: change a player's rank, role, and/or weekend window")
        .addUserOption((o) =>
          o.setName("user").setDescription("Player (mention)"),
        )
        .addStringOption((o) =>
          o
            .setName("discord_id")
            .setDescription("Discord user ID if you cannot mention them"),
        )
        .addStringOption((o) =>
          o
            .setName("rank")
            .setDescription("New medal / rank")
            .addChoices(...medalChoices),
        )
        .addStringOption((o) =>
          o
            .setName("role")
            .setDescription("New main role")
            .addChoices(...registerRoleChoices),
        )
        .addStringOption((o) =>
          o
            .setName("when")
            .setDescription("Weekend availability")
            .addChoices(...PLAY_WINDOW_DISCORD_CHOICES),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("dummy")
        .setDescription("TEST: create unsigned dummy players for auction")
        .addIntegerOption((o) =>
          o
            .setName("count")
            .setDescription("How many dummy players")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(20),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("dummy-clear")
        .setDescription("TEST: delete unsigned dummy players"),
    )
    .addSubcommand((s) =>
      s
        .setName("dummy-teams")
        .setDescription("TEST: create dummy teams with full rosters for schedule")
        .addIntegerOption((o) =>
          o
            .setName("count")
            .setDescription("How many dummy teams (default 2)")
            .setMinValue(1)
            .setMaxValue(4),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("dummy-teams-clear")
        .setDescription("TEST: delete dummy teams and their players"),
    ),
  new SlashCommandBuilder()
    .setName("rules")
    .setDescription("Cup rules")
    .addSubcommand((s) =>
      s
        .setName("post")
        .setDescription("Admin: post & pin full rules in #general")
        .addBooleanOption((o) =>
          o
            .setName("pin")
            .setDescription("Pin the message (default: true)"),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("channels")
        .setDescription(
          "Admin: pin a guide in #register, #payments, #captains, #auction, #results, #schedule, #general",
        )
        .addBooleanOption((o) =>
          o
            .setName("force")
            .setDescription("Post again even if a guide is already pinned"),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("closed")
        .setDescription(
          "Admin: remove old copies, then post closed / indoor / payment announcements once",
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("clear")
        .setDescription(
          "Admin: delete old registration / indoor / payment announcement embeds",
        ),
    ),
  new SlashCommandBuilder()
    .setName("registration")
    .setDescription("Admin: open or close public registration")
    .addSubcommand((s) =>
      s
        .setName("close")
        .setDescription("Close website + Discord public registration")
        .addBooleanOption((o) =>
          o
            .setName("announce")
            .setDescription("Also post the 3 announcements and create #payments (default: true)"),
        ),
    )
    .addSubcommand((s) =>
      s.setName("open").setDescription("Re-open website + Discord public registration"),
    )
    .addSubcommand((s) =>
      s.setName("status").setDescription("Show whether registration is open or closed"),
    ),
  new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Admin: payments channel, #admin help, cup setup")
    .addSubcommand((s) =>
      s
        .setName("setup")
        .setDescription("Create #payments (visible to everyone) and post commands in #admin"),
    )
    .addSubcommand((s) =>
      s.setName("help").setDescription("Post all bot commands into #admin"),
    ),
  new SlashCommandBuilder()
    .setName("bid")
    .setDescription("Bid on the player on the block")
    .addIntegerOption((o) =>
      o.setName("amount").setDescription("Bid amount").setRequired(true).setMinValue(100),
    ),
  new SlashCommandBuilder()
    .setName("purse")
    .setDescription("Your remaining auction points"),
  new SlashCommandBuilder()
    .setName("roster")
    .setDescription("Show a team roster")
    .addStringOption((o) =>
      o.setName("team").setDescription("Team name (default: yours)"),
    ),
  new SlashCommandBuilder()
    .setName("auction")
    .setDescription("Admin auction controls")
    .addSubcommand((s) =>
      s
        .setName("start")
        .setDescription("Start a role auction")
        .addStringOption((o) =>
          o
            .setName("role")
            .setDescription("Role pool")
            .setRequired(true)
            .addChoices(...roleChoices),
        ),
    )
    .addSubcommand((s) =>
      s.setName("pause").setDescription("Pause the live clock"),
    )
    .addSubcommand((s) =>
      s.setName("skip").setDescription("Mark the current player unsold"),
    )
    .addSubcommand((s) =>
      s.setName("undo").setDescription("Undo the last sale"),
    ),
  new SlashCommandBuilder()
    .setName("schedule")
    .setDescription("Weekend round-robin match schedule")
    .addSubcommand((s) =>
      s
        .setName("generate")
        .setDescription("Admin: build Fri/Sat/Sun fixtures for every team pair")
        .addStringOption((o) =>
          o
            .setName("friday")
            .setDescription("First Friday as YYYY-MM-DD (default: next Friday)"),
        )
        .addBooleanOption((o) =>
          o
            .setName("force")
            .setDescription("Replace fixtures that are still scheduled"),
        ),
    )
    .addSubcommand((s) =>
      s.setName("list").setDescription("Show upcoming scheduled matches"),
    )
    .addSubcommand((s) =>
      s
        .setName("final")
        .setDescription("Admin: schedule a BO3 grand final for the top 2")
        .addStringOption((o) =>
          o
            .setName("friday")
            .setDescription("Final Friday as YYYY-MM-DD (default: next Friday)"),
        )
        .addBooleanOption((o) =>
          o
            .setName("force")
            .setDescription("Replace a final that is still scheduled"),
        ),
    )
    .addSubcommand((s) =>
      s.setName("clear").setDescription("Admin: delete pending scheduled matches"),
    ),
  new SlashCommandBuilder()
    .setName("result")
    .setDescription("Import a match from OpenDota")
    .addSubcommand((s) =>
      s
        .setName("match")
        .setDescription("Pull stats by match ID or OpenDota link")
        .addStringOption((o) =>
          o
            .setName("match_id")
            .setDescription("Match ID or OpenDota / STRATZ link")
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("assign")
        .setDescription("Map an unknown Steam32 to a registered player")
        .addIntegerOption((o) =>
          o
            .setName("steam32")
            .setDescription("OpenDota account_id / Steam32")
            .setRequired(true),
        )
        .addUserOption((o) =>
          o.setName("user").setDescription("Registered player").setRequired(true),
        ),
    ),
  new SlashCommandBuilder()
    .setName("pay")
    .setDescription("Entry fees — unpaid players and team 5000 PKR status")
    .addSubcommand((s) =>
      s
        .setName("unpaid")
        .setDescription("List starters who have not paid (subs are free)"),
    )
    .addSubcommand((s) =>
      s
        .setName("teams")
        .setDescription("Which teams have collected exactly 5000 PKR"),
    )
    .addSubcommand((s) =>
      s
        .setName("team")
        .setDescription("Who on one team still owes (min/max 5000 PKR)")
        .addStringOption((o) =>
          o.setName("name").setDescription("Team name").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("mark")
        .setDescription("Admin: mark paid without the ✅ screenshot tick")
        .addUserOption((o) =>
          o.setName("user").setDescription("Player").setRequired(true),
        ),
    ),
].map((c) => c.toJSON());

function isOrganizer(member: GuildMember | null, discordId: string): boolean {
  if (isAdminDiscordId(discordId)) return true;
  if (!member) return false;
  const name = adminRoleName();
  return member.roles.cache.some((r) => r.name === name);
}

function fail(error: unknown): string {
  console.error(error);
  return publicErrorMessage(error);
}

async function editReplyChunks(
  interaction: ChatInputCommandInteraction,
  text: string,
) {
  const chunks = splitDiscordChunks(text);
  await interaction.editReply({
    content: chunks[0],
    allowedMentions: { parse: [] },
  });
  for (const chunk of chunks.slice(1)) {
    await interaction.followUp({
      content: chunk,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

function paymentStatusLine(player: {
  rosterRole: string | null;
  paidAt: Date | null;
  paymentAmount?: number | null;
}) {
  if (!playerMustPay(player.rosterRole)) {
    return "Fee: **substitute — no payment required**";
  }
  if (player.paidAt) {
    return `Fee: **paid** (${formatEntryFee()})`;
  }
  return `Fee: **unpaid** — ${formatEntryFee()} screenshot in **#${paymentsChannelName()}**, then wait for admin ✅`;
}

function parseDiscordSnowflake(raw: string): string {
  const trimmed = raw.trim();
  const mention = trimmed.match(/^<@!?(\d{17,20})>$/);
  if (mention) return mention[1];
  if (/^\d{17,20}$/.test(trimmed)) return trimmed;
  throw new Error(
    "discord_id must be a Discord user ID (the numbers) or a mention.",
  );
}

function playerDiscordIdFromEdit(interaction: ChatInputCommandInteraction): string {
  const rawId = interaction.options.getString("discord_id");
  const user = interaction.options.getUser("user");
  if (rawId) {
    const id = parseDiscordSnowflake(rawId);
    if (user && user.id !== id) {
      throw new Error("**user** and **discord_id** do not match. Use one of them.");
    }
    return id;
  }
  if (user) return user.id;
  throw new Error("Provide **user** (@mention) or **discord_id**.");
}

function medalLabel(medal: string): string {
  return MEDAL_LABELS[medal as Medal] ?? medal;
}

const pendingRegister = new Map<
  string,
  { steam: string; medal: string; playWindow: string }
>();

function roleSelectRow() {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("register:role")
      .setPlaceholder("Select your main role")
      .addOptions(
        registerRoleChoices.map((choice) => ({
          label: choice.name,
          value: choice.value,
        })),
      ),
  );
}

function siteUrl() {
  return (process.env.NEXTAUTH_URL || "https://dota2-cup.vercel.app").replace(
    /\/+$/,
    "",
  );
}

function playerPageUrl(playerId: string) {
  return `${siteUrl()}/players/${playerId}`;
}

function registerReplyLines(
  result: Awaited<ReturnType<typeof registerPlayer>>,
): string[] {
  const roles = formatRoles(parseRolesJson(result.player.rolesJson));
  return [
    `${result.created ? "✅ Registered" : "✅ Updated"} **${result.player.steamName}**`,
    `Website profile: ${playerPageUrl(result.player.id)}`,
    `Steam: ${result.profileUrl}`,
    `Steam32: \`${result.player.steam32}\` · ${result.player.medal} · ${roles}`,
    `Weekends: **${PLAY_WINDOW_LABELS[playWindowOrBoth(result.player.playWindow)]}** — change anytime with \`/when\``,
    `If the bot is down next time, register at ${siteUrl()}/register`,
    result.openDotaLinked
      ? "OpenDota recognizes this account — match stats will import automatically."
      : "⚠️ OpenDota has no Dota 2 history yet for this account. Queue on this exact Steam account or stats will not count.",
  ];
}

function isRegisterChannel(interaction: { channel: unknown }) {
  const channel = interaction.channel;
  const name =
    channel && typeof channel === "object" && "name" in channel
      ? String((channel as { name?: unknown }).name ?? "")
      : "";
  return name.toLowerCase() === registerChannelName().toLowerCase();
}

function registerOnlyHereMessage() {
  return `Registration is only allowed in **#${registerChannelName()}**. Go there and run \`/register\` again.`;
}

function registerRoleOption(interaction: ChatInputCommandInteraction): string | null {
  return (
    interaction.options.getString("role") ??
    interaction.options.getString("roles")
  );
}

function findTextChannel(
  guild: NonNullable<ChatInputCommandInteraction["guild"]>,
  name: string,
): TextChannel | null {
  const found = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildText &&
      ch.name.toLowerCase() === name.toLowerCase(),
  );
  return found?.type === ChannelType.GuildText ? found : null;
}

function lotEmbed(view: ReturnType<typeof getAuctionView>) {
  const embed = new EmbedBuilder()
    .setColor(view.status === "running" ? 0xd4a24c : 0x6b7280)
    .setTitle(
      view.role
        ? `ON THE BLOCK — ${ROLE_LABELS[view.role].toUpperCase()}`
        : "Auction idle",
    );

  if (view.currentPlayer && view.role) {
    const roles = formatRoles(parseRolesJson(view.currentPlayer.rolesJson));
    embed.addFields(
      {
        name: "Player",
        value: `**${view.currentPlayer.steamName}**`,
        inline: true,
      },
      {
        name: "Rank",
        value: MEDAL_LABELS[view.currentPlayer.medal as keyof typeof MEDAL_LABELS] ?? view.currentPlayer.medal,
        inline: true,
      },
      {
        name: "Role",
        value: ROLE_LABELS[view.role],
        inline: true,
      },
      {
        name: "Current bid",
        value: `**${view.currentBid}**`,
        inline: true,
      },
      {
        name: "High bidder",
        value: view.highBidder?.name ?? "— waiting —",
        inline: true,
      },
      {
        name: "Clock",
        value:
          view.status === "paused"
            ? "paused"
            : view.status === "running" && view.endsAt && view.secondsLeft > 0
              ? `<t:${Math.floor(view.endsAt.getTime() / 1000)}:R>`
              : "Ended",
        inline: true,
      },
      { name: "Listed roles", value: roles, inline: false },
    );
    embed.setFooter({
      text: `${view.remainingInRole} still in the ${ROLE_LABELS[view.role]} queue`,
    });
  } else {
    embed.setDescription("No player on the block. Admin: `/auction start`.");
  }
  return embed;
}

function purseLines(
  balances: { name: string; purse: number; rosterCount: number }[],
) {
  if (balances.length === 0) return "No teams yet.";
  return balances
    .map((t) => {
      const slots = `${t.rosterCount}/${MAX_ROSTER}`;
      const full = t.rosterCount >= MAX_ROSTER ? " · FULL" : "";
      return `**${t.name}** — **${t.purse}** left · ${slots}${full}`;
    })
    .join("\n");
}

function saleEmbed(view: ReturnType<typeof getAuctionView>) {
  const sale = view.lastSale;
  const balances = sale?.balances ?? view.teamBalances;
  if (!sale) {
    return new EmbedBuilder().setColor(0x6b7280).setTitle("Lot closed");
  }
  if (sale.teamName && sale.price != null) {
    return new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("SOLD")
      .setDescription(
        `**${sale.playerName}** joins **${sale.teamName}** for **${sale.price}**`,
      )
      .addFields(
        {
          name: "Rank",
          value: MEDAL_LABELS[sale.medal as keyof typeof MEDAL_LABELS] ?? sale.medal,
          inline: true,
        },
        {
          name: "Role",
          value: ROLE_LABELS[sale.role],
          inline: true,
        },
        {
          name: "Team purses",
          value: purseLines(balances),
        },
      );
  }
  return new EmbedBuilder()
    .setColor(0x9ca3af)
    .setTitle("UNSOLD")
    .setDescription(`**${sale.playerName}** goes back to the pool.`)
    .addFields(
      {
        name: "Role",
        value: ROLE_LABELS[sale.role],
        inline: true,
      },
      {
        name: "Team purses",
        value: purseLines(balances),
      },
    );
}

function doneEmbed(view: ReturnType<typeof getAuctionView>) {
  const role = view.lastSale?.role ?? view.role;
  return new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle("Auction complete")
    .setDescription(
      role
        ? `The **${ROLE_LABELS[role]}** queue is finished.`
        : "This role queue is finished.",
    );
}

function lotButtons() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("bid:open")
      .setLabel("Bid (open / +0)")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`bid:${BID_INCREMENT}`)
      .setLabel(`+${BID_INCREMENT}`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("bid:500")
      .setLabel("+500")
      .setStyle(ButtonStyle.Success),
  );
}

async function closeLotMessage(
  channel: TextChannel,
  messageId: string | null,
  clockLabel = "Ended",
) {
  if (!messageId) return;
  try {
    const existing = await channel.messages.fetch(messageId);
    const previous = existing.embeds[0];
    if (!previous) {
      await existing.edit({ components: [] });
      return;
    }
    const embed = EmbedBuilder.from(previous);
    embed.setColor(0x6b7280);
    const fields = (embed.data.fields ?? []).map((field) =>
      field.name === "Clock" ? { ...field, value: clockLabel } : field,
    );
    if (fields.length > 0) embed.setFields(fields);
    await existing.edit({ embeds: [embed], components: [] });
  } catch {
    /* old message gone */
  }
}

async function postNewLot(channel: TextChannel, view: ReturnType<typeof getAuctionView>) {
  const sent = await channel.send({
    embeds: [lotEmbed(view)],
    components: view.status === "running" && view.currentPlayer ? [lotButtons()] : [],
  });
  saveAuctionMessage(channel.id, sent.id);
}

async function publishLot(channel: TextChannel, view: ReturnType<typeof getAuctionView>) {
  if (view.event === "sold" || view.event === "unsold" || view.event === "done") {
    await closeLotMessage(
      channel,
      view.messageId,
      view.event === "sold" ? "Sold" : view.event === "unsold" ? "Unsold" : "Ended",
    );
    clearAuctionMessage();
    await channel.send({ embeds: [saleEmbed(view)] });
    if (view.event === "done" || !view.currentPlayer) {
      await channel.send({ embeds: [doneEmbed(view)] });
      markAuctionAnnounced();
      return;
    }
    await postNewLot(channel, view);
    markAuctionAnnounced();
    return;
  }

  if (view.event === "lot" || !view.messageId || view.channelId !== channel.id) {
    await closeLotMessage(channel, view.messageId);
    clearAuctionMessage();
    await postNewLot(channel, view);
    markAuctionAnnounced();
    return;
  }

  try {
    const existing = await channel.messages.fetch(view.messageId);
    await existing.edit({
      embeds: [lotEmbed(view)],
      components: view.status === "running" && view.currentPlayer ? [lotButtons()] : [],
    });
  } catch {
    await postNewLot(channel, view);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
});

async function handleSlash(interaction: ChatInputCommandInteraction) {
  const name = interaction.commandName;
  const member = interaction.member as GuildMember | null;
  const discordId = interaction.user.id;
  const discordName =
    interaction.user.globalName || interaction.user.username;

  try {
    if (name === "register") {
      if (!isRegisterChannel(interaction)) {
        await interaction.reply({
          content: registerOnlyHereMessage(),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!(await isRegistrationOpen()) && !isOrganizer(member, discordId)) {
        await interaction.reply({
          content: registrationClosedDiscordReply(),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply();
      const steam = interaction.options.getString("steam", true);
      const medal = interaction.options.getString("rank", true);
      const playWindow = interaction.options.getString("when", true);
      const role = registerRoleOption(interaction);
      if (!role) {
        pendingRegister.set(discordId, { steam, medal, playWindow });
        await interaction.editReply({
          content: "Select your **main role** from the dropdown below.",
          components: [roleSelectRow()],
        });
        return;
      }
      const result = await registerPlayer({
        discordId,
        discordName,
        steam,
        medal,
        role,
        playWindow,
      });
      void notifySiteRefresh();
      await trySetPlayWindowRoles(
        interaction.guild,
        discordId,
        playWindowOrBoth(result.player.playWindow),
      );
      await interaction.editReply({
        content: registerReplyLines(result).join("\n"),
      });
      return;
    }

    if (name === "when") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const window = interaction.options.getString("window", true);
      const result = await setPlayerPlayWindow(discordId, window);
      await trySetPlayWindowRoles(
        interaction.guild,
        discordId,
        result.playWindow,
      );
      await interaction.editReply(
        `Weekend window for **${result.steamName}** is now **${PLAY_WINDOW_LABELS[result.playWindow]}**.\nThe website and next \`/schedule generate\` will use this.`,
      );
      return;
    }

    if (name === "me") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const player = await prisma.player.findFirst({
        where: {
          OR: [{ discordId }, { discordId: { startsWith: `${discordId}:` } }],
        },
        include: { team: true },
      });
      if (!player) {
        await interaction.editReply(
          (await isRegistrationOpen())
            ? "You are not registered. Use `/register`."
            : "You are not registered. Public sign-ups are closed — ask an admin to `/player register` you.",
        );
        return;
      }
      const roles = formatRoles(parseRolesJson(player.rolesJson));
      const sub = player.rosterRole === "sub" ? " · Sub" : "";
      const window = PLAY_WINDOW_LABELS[playWindowOrBoth(player.playWindow)];
      const team = player.team
        ? `Team **${player.team.name}**${player.isCaptain ? " · captain" : ""}${sub}`
        : "Unsigned — you will appear in the auction";
      await interaction.editReply(
        `**${player.steamName}** · ${player.medal} · ${roles}\nWeekends: **${window}** (change with \`/when\`)\nWebsite: ${playerPageUrl(player.id)}\nSteam: ${steamProfileUrl(player.steam32)}\nSteam32 \`${player.steam32}\`\n${team}\n${paymentStatusLine(player)}`,
      );
      return;
    }

    if (name === "help") {
      const chunks = splitDiscordChunks(fullHelpText());
      await interaction.reply({
        content: chunks[0],
        flags: MessageFlags.Ephemeral,
      });
      for (const chunk of chunks.slice(1)) {
        await interaction.followUp({
          content: chunk,
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    if (name === "registration") {
      if (!isOrganizer(member, discordId)) {
        await interaction.reply({
          content: `Only **${adminRoleName()}** can open or close registration.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const sub = interaction.options.getSubcommand();
      if (sub === "status") {
        const open = await isRegistrationOpen();
        await interaction.reply({
          content: open
            ? "Public registration is **open** (website + `/register`)."
            : "Public registration is **closed**. Late add: `/player register`. Re-open: `/registration open`.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (sub === "open") {
        await setRegistrationOpen(true);
        void notifySiteRefresh();
        await interaction.editReply(
          "Public registration is **open** on the website and `/register`.",
        );
        return;
      }
      await setRegistrationOpen(false);
      void notifySiteRefresh();
      const announce = interaction.options.getBoolean("announce") ?? true;
      let extra = "";
      if (announce && interaction.guild) {
        const cleared = await clearCupAnnouncements(
          interaction.guild,
          client.user!.id,
        );
        const posted = await postCupAnnouncements(interaction.guild);
        extra =
          "\n\n" +
          [...cleared, ...posted]
            .map((r) => `${r.ok ? "✅" : "❌"} #${r.channel} — ${r.detail}`)
            .join("\n");
      }
      await interaction.editReply(
        `Public registration is **closed** on the website and Discord.${extra}\n\nAdd someone: \`/player register\`\nRemove someone: \`/player delete @user\` (also takes them off a team). Captains: \`/captain remove\` first.`,
      );
      return;
    }

    if (name === "admin") {
      if (!isOrganizer(member, discordId)) {
        await interaction.reply({
          content: `Only **${adminRoleName()}** can run cup setup.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!interaction.guild) {
        await interaction.reply({
          content: "Run this in your Discord server.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const sub = interaction.options.getSubcommand();
      if (sub === "help") {
        try {
          const admin = await ensureAdminChannel(interaction.guild);
          const help = await postAdminCommandHelp(admin, {
            force: true,
            botUserId: client.user?.id,
          });
          await interaction.editReply(
            help.skipped
              ? `Command help is already in ${admin}.`
              : `Posted every command into ${admin}.`,
          );
        } catch (error) {
          await editReplyChunks(
            interaction,
            `${describeDiscordChannelError(error, adminChannelName())}\n\nCommand list (here, since #${adminChannelName()} is locked):\n\n${fullHelpText()}`,
          );
        }
        return;
      }
      const results = await setupCupDiscord(interaction.guild, {
        botUserId: client.user?.id,
        announce: false,
        forceHelp: true,
      });
      const body = results
        .map((r) => `${r.ok ? "✅" : "❌"} #${r.channel} — ${r.detail}`)
        .join("\n");
      const failedPayments = results.some(
        (r) => !r.ok && r.channel.toLowerCase().includes("payment"),
      );
      const failedAdmin = results.some(
        (r) => !r.ok && r.channel.toLowerCase() === adminChannelName().toLowerCase(),
      );
      const invite = failedPayments
        ? `\n\nIf **#${paymentsChannelName()}** is missing, the bot needs **Manage Channels**. Re-invite:\n${botInviteUrl(botClientId)}\nOr create a public text channel named **${paymentsChannelName()}**, then run \`/admin setup\` again.`
        : "";
      const helpFallback = failedAdmin
        ? `\n\nCommand list (posted here because **#${adminChannelName()}** is locked):\n\n${fullHelpText()}`
        : "";
      await editReplyChunks(
        interaction,
        `Cup channels updated.\n${body}${invite}\n\nPlayers: screenshot in **#${paymentsChannelName()}**, then an Admin clicks ✅.\nList players: \`/player list\`.${helpFallback}`,
      );
      return;
    }

    if (name === "captain") {
      if (!isOrganizer(member, discordId)) {
        await interaction.reply({
          content: `Only the **${adminRoleName()}** role (or listed admin IDs) can manage captains.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply();
      const sub = interaction.options.getSubcommand();
      if (sub === "add") {
        const user = interaction.options.getUser("user", true);
        const team = await adminAddCaptain({
          discordId: user.id,
          teamName: interaction.options.getString("team", true),
        });
        const roleNote = await trySetMemberCaptainRole(
          interaction.guild,
          user.id,
          true,
        );
        if (interaction.guild) {
          try {
            await syncCupChannelAccess(interaction.guild);
          } catch (error) {
            console.warn(
              "channel access after captain add",
              error instanceof Error ? error.message : error,
            );
          }
        }
        void notifySiteRefresh();
        await interaction.editReply(
          [
            `${user} is now captain of **${team.name}** (${STARTING_PURSE} points).`,
            roleNote ??
              "They can use **#captains** and chat in **#auction**.",
          ].join("\n"),
        );
        return;
      }
      const user = interaction.options.getUser("user", true);
      const removed = await adminRemoveCaptain(user.id);
      const roleNote = await trySetMemberCaptainRole(
        interaction.guild,
        user.id,
        false,
      );
      void notifySiteRefresh();
      await interaction.editReply(
        [
          `Removed captain ${user}. **${removed.teamName}** is dissolved; players are unsigned again.`,
          roleNote,
        ]
          .filter(Boolean)
          .join("\n"),
      );
      return;
    }

    if (name === "player") {
      if (!isOrganizer(member, discordId)) {
        await interaction.reply({
          content: `Only the **${adminRoleName()}** role (or listed admin IDs) can manage players.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply();
      const sub = interaction.options.getSubcommand();
      if (sub === "list") {
        const players = await listRegisteredPlayers();
        await editReplyChunks(interaction, formatPlayerDirectory(players));
        return;
      }
      if (sub === "dummy") {
        const count = interaction.options.getInteger("count", true);
        const result = await adminCreateDummyPlayers(count);
        await interaction.editReply(
          `Created **${result.created.length}** dummy players:\n${result.created.map((n) => `• ${n}`).join("\n")}\nThey appear on the site and in \`/auction start\`.`,
        );
        return;
      }
      if (sub === "dummy-clear") {
        const result = await adminClearDummyPlayers();
        await interaction.editReply(
          result.removed === 0
            ? "No unsigned dummy players to delete."
            : `Deleted **${result.removed}** dummy players.`,
        );
        return;
      }
      if (sub === "dummy-teams") {
        const count = interaction.options.getInteger("count") ?? 2;
        const result = await adminCreateDummyTeams(count);
        const body = result.created
          .map((t) => `• **${t.name}** — ${t.players.length}/7`)
          .join("\n");
        await interaction.editReply(
          `Created **${result.created.length}** dummy teams:\n${body}\nNext: \`/schedule generate\` when every team has 5+ players.`,
        );
        return;
      }
      if (sub === "dummy-teams-clear") {
        const result = await adminClearDummyTeams();
        await interaction.editReply(
          result.teams === 0
            ? "No dummy teams to delete."
            : `Deleted **${result.teams}** dummy teams and **${result.players}** dummy players.`,
        );
        return;
      }
      if (sub === "register") {
        const user = interaction.options.getUser("user", true);
        const result = await registerPlayer({
          discordId: user.id,
          discordName: user.globalName || user.username,
          steam: interaction.options.getString("steam", true),
          medal: interaction.options.getString("rank", true),
          role: interaction.options.getString("role", true),
          playWindow: interaction.options.getString("when", true),
        });
        void notifySiteRefresh();
        await trySetPlayWindowRoles(
          interaction.guild,
          user.id,
          playWindowOrBoth(result.player.playWindow),
        );
        await interaction.editReply(
          [
            `Admin registered ${user}.`,
            ...registerReplyLines(result),
            playerMustPay(result.player.rosterRole)
              ? `They still owe **${formatEntryFee()}** — screenshot in **#${paymentsChannelName()}**, admin ✅ to confirm.`
              : "Substitute — no entry fee.",
          ].join("\n"),
        );
        return;
      }
      if (sub === "edit") {
        const targetId = playerDiscordIdFromEdit(interaction);
        const result = await adminUpdatePlayerProfile({
          discordId: targetId,
          medal: interaction.options.getString("rank"),
          role: interaction.options.getString("role"),
          playWindow: interaction.options.getString("when"),
        });
        const live = patchLivePlayer(result.player.id, {
          medal: result.player.medal,
          rolesJson: result.player.rolesJson,
        });
        const lines = [
          `Updated **${result.player.steamName}** (\`${targetId}\`)`,
          `Rank: ${medalLabel(result.previousMedal)} → **${medalLabel(result.player.medal)}** (start price ${basePriceFor(result.player.medal).toLocaleString()})`,
          `Role: ${formatRoles(parseRolesJson(result.previousRolesJson))} → **${formatRoles(parseRolesJson(result.player.rolesJson))}**`,
          `Weekends: ${PLAY_WINDOW_SHORT[playWindowOrBoth(result.previousPlayWindow)]} → **${PLAY_WINDOW_LABELS[playWindowOrBoth(result.player.playWindow)]}**`,
        ];
        await trySetPlayWindowRoles(
          interaction.guild,
          targetId,
          playWindowOrBoth(result.player.playWindow),
        );
        if (result.teamName) {
          lines.push(
            `On team **${result.teamName}** — auction purse / sold price were not changed.`,
          );
        } else if (!live.patched) {
          lines.push(
            "If this role's auction is already running, `/auction start` that pool again so they appear in the right queue.",
          );
        } else if (live.bidReset) {
          lines.push("Live auction start price was updated (no bid yet).");
        }
        await interaction.editReply(lines.join("\n"));
        return;
      }
      const user = interaction.options.getUser("user", true);
      if (sub === "delete") {
        const removed = await adminDeletePlayer(user.id);
        await interaction.editReply(
          `Deleted registration for **${removed.name}**.${
            removed.teamName ? ` Removed from **${removed.teamName}**.` : ""
          } ${
            (await isRegistrationOpen())
              ? "They can `/register` again."
              : "To add them back, use `/player register`."
          }`,
        );
        return;
      }
      if (sub === "add") {
        const result = await adminAddPlayerToTeam({
          discordId: user.id,
          teamName: interaction.options.getString("team", true),
        });
        await interaction.editReply(
          `Added **${result.player.steamName}** to **${result.team.name}**.`,
        );
        return;
      }
      if (sub === "remove") {
        const removed = await adminRemovePlayerFromTeam(user.id);
        await interaction.editReply(
          `Removed **${removed.name}** from **${removed.teamName}**.`,
        );
        return;
      }
      const synced = await adminResyncRosterRole(user.id);
      await interaction.editReply(
        `Rebalanced **${synced.name}**'s team roster (5 starters + up to 2 subs).`,
      );
      return;
    }

    if (name === "pay") {
      const sub = interaction.options.getSubcommand();
      if (sub === "mark") {
        if (!isOrganizer(member, discordId)) {
          await interaction.reply({
            content: `Only **${adminRoleName()}** can mark someone paid.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const user = interaction.options.getUser("user", true);
        const result = await adminMarkPaid(user.id, discordId);
        void notifySiteRefresh();
        if (result.skipped) {
          await interaction.editReply(
            `${user} is a **substitute** — they do not pay.`,
          );
          return;
        }
        const teamNote = result.player.team
          ? `\nTeam **${result.player.team.name}**.`
          : "";
        await interaction.editReply(
          result.alreadyPaid
            ? `${user} was already marked paid.${teamNote}`
            : `Marked ${user} paid **${formatEntryFee()}**.${teamNote}`,
        );
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (sub === "unpaid") {
        const unpaid = await listUnpaidPlayers();
        await editReplyChunks(interaction, formatUnpaidList(unpaid));
        return;
      }
      if (sub === "team") {
        const name = interaction.options.getString("name", true);
        const row = await findTeamPaymentsByName(name);
        if (!row) {
          await interaction.editReply(`No team matching **${name}**.`);
          return;
        }
        await editReplyChunks(interaction, formatTeamPaymentDetail(row));
        return;
      }
      const teams = await listTeamPayments();
      await editReplyChunks(interaction, formatTeamPaymentsList(teams));
      return;
    }

    if (name === "bid") {
      await interaction.deferReply();
      const view = await placeBid({
        discordId,
        amount: interaction.options.getInteger("amount", true),
      });
      await interaction.editReply({
        content: `Bid **${view.currentBid}** from ${view.highBidder?.name ?? "?"} on **${view.currentPlayer?.steamName}**.`,
      });
      if (interaction.channel?.type === ChannelType.GuildText) {
        await publishLot(interaction.channel, view);
      }
      return;
    }

    if (name === "purse") {
      const { team } = await getTeamByCaptainDiscord(discordId);
      await interaction.reply({
        content: `**${team.name}** has **${team.purse}** / ${STARTING_PURSE} points.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (name === "roster") {
      const q = interaction.options.getString("team");
      const team = q
        ? await prisma.team.findFirst({
            where: { name: { equals: q } },
            include: { players: true },
          })
        : (await getTeamByCaptainDiscord(discordId)).team;
      if (!team) {
        await interaction.reply({
          content: "Team not found.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.reply({
        content: `**${team.name}** · ${team.players.length}/7 · purse ${team.purse}\n${rosterSummary(team.players) || "_empty_"}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (name === "auction") {
      if (!isOrganizer(member, discordId)) {
        await interaction.reply({
          content: `Only **${adminRoleName()}** can control the auction.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply();
      const sub = interaction.options.getSubcommand();
      let view;
      if (sub === "start") {
        view = await startAuction(interaction.options.getString("role", true));
      } else if (sub === "pause") {
        view = await pauseAuction();
      } else if (sub === "skip") {
        view = await skipLot();
      } else {
        view = await undoLastSale();
      }
      await interaction.editReply({
        content:
          sub === "start"
            ? `Started **${ROLE_LABELS[view.role as Role]}** auction.`
            : `Auction ${sub}.`,
      });
      if (interaction.channel?.type === ChannelType.GuildText) {
        await publishLot(interaction.channel, view);
      }
      return;
    }

    if (name === "rules") {
      const sub = interaction.options.getSubcommand();
      if (!isOrganizer(member, discordId)) {
        await interaction.reply({
          content: `Only **${adminRoleName()}** can post rules.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      if (sub === "channels") {
        if (!interaction.guild) {
          await interaction.reply({
            content: "Run this in your Discord server.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const force = interaction.options.getBoolean("force") ?? false;
        const results = await postChannelGuides(
          interaction.guild,
          client.user!.id,
          { force },
        );
        let access = "";
        try {
          await syncCupChannelAccess(interaction.guild);
          access = `\n\n${describeChannelAccess()}`;
        } catch (error) {
          access = `\n\n⚠️ Could not lock #captains / #auction. Give the bot **Manage Channels** and **Manage Roles**.`;
          console.error("channel access", error);
        }
        await interaction.editReply(
          `${formatGuideResults(results).join("\n")}${access}`,
        );
        return;
      }

      if (sub === "clear") {
        if (!interaction.guild) {
          await interaction.reply({
            content: "Run this in your Discord server.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const results = await clearCupAnnouncements(
          interaction.guild,
          client.user!.id,
        );
        const body = results
          .map((r) => `${r.ok ? "✅" : "❌"} #${r.channel} — ${r.detail}`)
          .join("\n");
        await interaction.editReply(
          `Removed old announcement copies.\n${body}\n\nPost a fresh set once with \`/rules closed\`.`,
        );
        return;
      }

      if (sub === "closed") {
        if (!interaction.guild) {
          await interaction.reply({
            content: "Run this in your Discord server.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const cleared = await clearCupAnnouncements(
          interaction.guild,
          client.user!.id,
        );
        const posted = await postCupAnnouncements(interaction.guild);
        const body = [...cleared, ...posted]
          .map((r) => `${r.ok ? "✅" : "❌"} #${r.channel} — ${r.detail}`)
          .join("\n");
        await interaction.editReply(
          `Cleared old copies, then posted **one** set.\n${body}\n\n**#general:** registration closed + indoor tournament\n**#${paymentsChannelName()}:** payment rules (SadaPay ${paymentAccountNumber()})`,
        );
        return;
      }

      if (sub === "post") {
        const pin = interaction.options.getBoolean("pin") ?? true;
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const targetName = rulesChannelName();
        let channel: TextChannel | null = null;
        if (interaction.guild) {
          channel = findTextChannel(interaction.guild, targetName);
        }
        if (!channel && interaction.channel?.type === ChannelType.GuildText) {
          channel = interaction.channel;
        }
        if (!channel) {
          await interaction.editReply(
            `Could not find #${targetName}. Create the channel or set RULES_CHANNEL_NAME.`,
          );
          return;
        }
        const embed = buildRulesEmbed();
        const sent = await channel.send({ embeds: [embed] });
        if (pin) {
          try {
            await sent.pin();
          } catch {
            await interaction.editReply(
              `Rules posted in ${channel} but I could not pin (need **Manage Messages**).`,
            );
            return;
          }
        }
        await interaction.editReply(
          pin
            ? `Rules posted and pinned in ${channel}.`
            : `Rules posted in ${channel}.`,
        );
      }
      return;
    }

    if (name === "schedule") {
      const sub = interaction.options.getSubcommand();
      if (sub === "list") {
        const fixtures = await listScheduledFixtures(15);
        const body = formatScheduleSummary(fixtures);
        const total = await listScheduledFixtures(500);
        await interaction.reply({
          content:
            fixtures.length === 0
              ? "No fixtures scheduled. Admin: `/schedule generate` after every team has 5+ players."
              : `**Upcoming schedule** (${total.length} total)\n${body}`,
        });
        return;
      }
      if (!isOrganizer(member, discordId)) {
        await interaction.reply({
          content: `Only **${adminRoleName()}** can manage the schedule.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (sub === "clear") {
        const n = await clearScheduledFixtures();
        await interaction.reply(
          n === 0
            ? "No pending fixtures to clear."
            : `Cleared **${n}** scheduled fixtures.`,
        );
        return;
      }
      if (sub === "final") {
        await interaction.deferReply();
        const result = await generateGrandFinal({
          friday: interaction.options.getString("friday") ?? undefined,
          force: interaction.options.getBoolean("force") ?? false,
        });
        await interaction.editReply({
          content: [
            `🏆 Grand final booked — **best of ${result.bestOf}** (first to 2).`,
            `**${result.radiantName}** vs **${result.direName}**`,
            formatScheduleWhen(result.scheduledAt),
          ].join("\n"),
        });
        return;
      }
      await interaction.deferReply();
      const result = await generateWeekendSchedule({
        friday: interaction.options.getString("friday") ?? undefined,
        force: interaction.options.getBoolean("force") ?? false,
      });
      const preview = result.fixtures
        .slice(0, 8)
        .map(
          (f, i) =>
            `**${i + 1}.** ${formatScheduleWhen(f.scheduledAt)} — **${f.radiantName}** vs **${f.direName}**`,
        )
        .join("\n");
      const more =
        result.matchCount > 8
          ? `\n… and **${result.matchCount - 8}** more. Use \`/schedule list\`.`
          : "";
      await interaction.editReply({
        content: [
          `✅ Scheduled **${result.matchCount}** best-of-1 matches for **${result.teamCount}** teams (every pair once).`,
          `First weekend starts **${formatScheduleWhen(result.firstFriday)}**.`,
          preview + more,
        ].join("\n"),
      });
      return;
    }

    if (name === "result") {
      const sub = interaction.options.getSubcommand();
      if (sub === "assign") {
        if (!isOrganizer(member, discordId)) {
          await interaction.reply({
            content: "Only an admin can assign unknown Steam IDs.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        const player = await assignUnknown({
          steam32: interaction.options.getInteger("steam32", true),
          discordId: interaction.options.getUser("user", true).id,
        });
        await interaction.reply(
          `Linked Steam32 \`${player.steam32}\` to **${player.steamName}**.`,
        );
        return;
      }
      await interaction.deferReply();
      const match = await ingestMatch({
        raw: interaction.options.getString("match_id", true),
      });
      void notifySiteRefresh();
      await interaction.editReply(formatMatchReply(match));
    }
  } catch (error) {
    const text = fail(error);
    try {
      if (interaction.deferred) {
        await interaction.editReply(text);
      } else if (interaction.replied) {
        await interaction.followUp({ content: text, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
      }
    } catch {
      /* interaction expired — ignore */
    }
  }
}

function formatMatchReply(match: Awaited<ReturnType<typeof ingestMatch>>): string {
  const radiant = match.radiantTeam?.name ?? "Radiant (unmapped)";
  const dire = match.direTeam?.name ?? "Dire (unmapped)";
  const winner = match.winnerTeam?.name
    ?? (match.radiantWin ? "Radiant" : "Dire");
  const unknown = match.players.filter((p) => p.unknown).length;
  const lines = match.players.map((p) => {
    const name = p.player?.steamName ?? `unknown ${p.steam32}`;
    return `${p.side === "radiant" ? "R" : "D"} ${name} — ${p.hero} ${p.kills}/${p.deaths}/${p.assists} LH ${p.lastHits}`;
  });
  return [
    `Match \`${match.openDotaId}\` imported. **${winner}** beat ${match.radiantWin ? dire : radiant}.`,
    `${radiant} vs ${dire}`,
    unknown ? `${unknown} unknown Steam account(s) — admin can \`/result assign\`.` : "All 10 players mapped.",
    lines.join("\n"),
  ].join("\n");
}

async function saveProof(message: Message, matchHint: string): Promise<string | null> {
  const image = message.attachments.find((a) =>
    (a.contentType ?? "").startsWith("image/") ||
    /\.(png|jpe?g|webp|gif)$/i.test(a.name ?? ""),
  );
  if (!image) return null;
  const dir = path.join(process.cwd(), "public", "uploads", "matches");
  await mkdir(dir, { recursive: true });
  const ext = path.extname(new URL(image.url).pathname) || ".png";
  const file = `${matchHint}${ext}`;
  const res = await fetch(image.url);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(dir, file), buf);
  return `/uploads/matches/${file}`;
}

const PAY_TICK = "✅";

function isPayTickEmoji(name: string | null) {
  return (
    name === PAY_TICK ||
    name === "✔️" ||
    name === "☑️" ||
    name === "✔" ||
    name === "white_check_mark"
  );
}

function paymentProofTarget(message: Message) {
  const mentioned = message.mentions.users.filter((user) => !user.bot);
  if (
    mentioned.size === 1 &&
    isOrganizer(message.member, message.author.id)
  ) {
    return mentioned.first()!;
  }
  return message.author;
}

/** Put ✅ on screenshots so an admin can confirm 1000 PKR. Do not save the image. */
async function offerPaymentTick(message: Message): Promise<boolean> {
  if (message.channel.type !== ChannelType.GuildText) return false;
  if (!isPaymentsChannelName(message.channel.name)) {
    return false;
  }
  if (!messageHasImage(message)) return false;
  await message.react(PAY_TICK).catch((error) => {
    console.warn(
      "Could not add ✅ on payment screenshot (need Add Reactions):",
      error instanceof Error ? error.message : error,
    );
  });
  return true;
}

async function handlePaymentTick(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
) {
  if (user.bot) return;
  if (!isPayTickEmoji(reaction.emoji.name)) return;
  const message = reaction.message.partial
    ? await reaction.message.fetch()
    : reaction.message;
  if (message.author.bot) return;
  if (message.channel.type !== ChannelType.GuildText) return;
  if (!isPaymentsChannelName(message.channel.name)) {
    return;
  }
  if (!messageHasImage(message)) return;

  const guild = message.guild;
  if (!guild) return;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!isOrganizer(member, user.id)) return;

  const target = paymentProofTarget(message);
  try {
    const result = await recordPlayerPayment({
      discordId: target.id,
      discordName: target.globalName || target.username,
      verifiedBy: user.id,
    });
    if (result.skipped) {
      await message.reply(
        `${target} is a **substitute** — no entry fee.`,
      );
      return;
    }
    if (result.alreadyPaid) return;
    void notifySiteRefresh();
    let teamLine = "";
    if (result.player.team) {
      const teams = await listTeamPayments();
      const row = teams.find((t) => t.id === result.player.team?.id);
      if (row) teamLine = `\n${formatTeamPaymentLine(row)}`;
    }
    await message.reply(
      `✅ Admin confirmed **${formatEntryFee()}** for ${target} (**${result.player.steamName}**).${teamLine}`,
    );
  } catch (error) {
    await message.reply(fail(error));
  }
}

async function handlePrefixResult(message: Message) {
  const text = message.content.trim();
  if (!/^!result\b/i.test(text) && !/opendota\.com\/matches\/\d+/i.test(text)) {
    return;
  }
  const raw = text.replace(/^!result\s+/i, "").trim() || text;
  try {
    const hint = raw.match(/\d{8,12}/)?.[0] ?? `shot-${Date.now()}`;
    const screenshotPath = await saveProof(message, hint);
    const match = await ingestMatch({ raw, screenshotPath });
    void notifySiteRefresh();
    await message.reply(formatMatchReply(match));
  } catch (error) {
    await message.reply(fail(error));
  }
}

client.on("interactionCreate", async (interaction: Interaction) => {
  if (interaction.isStringSelectMenu() && interaction.customId === "register:role") {
    if (!isRegisterChannel(interaction)) {
      await interaction.reply({
        content: registerOnlyHereMessage(),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (
      !(await isRegistrationOpen()) &&
      !isOrganizer(interaction.member as GuildMember | null, interaction.user.id)
    ) {
      await interaction.reply({
        content: registrationClosedDiscordReply(),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const discordId = interaction.user.id;
    const pending = pendingRegister.get(discordId);
    if (!pending) {
      await interaction.reply({
        content: "Run `/register` again, then pick a role from the dropdown.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const role = interaction.values[0];
    if (!role) {
      await interaction.reply({
        content: "Pick a role from the dropdown.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    pendingRegister.delete(discordId);
    await interaction.deferUpdate();
    try {
      const result = await registerPlayer({
        discordId,
        discordName:
          interaction.user.globalName || interaction.user.username,
        steam: pending.steam,
        medal: pending.medal,
        role,
        playWindow: pending.playWindow,
      });
      void notifySiteRefresh();
      await trySetPlayWindowRoles(
        interaction.guild,
        discordId,
        playWindowOrBoth(result.player.playWindow),
      );
      await interaction.editReply({
        content: registerReplyLines(result).join("\n"),
        components: [],
      });
    } catch (error) {
      pendingRegister.set(discordId, pending);
      await interaction.editReply({
        content: fail(error),
        components: [roleSelectRow()],
      });
    }
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith("bid:")) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const spec = interaction.customId.slice(4);
      const view =
        spec === "open"
          ? await placeBid({ discordId: interaction.user.id })
          : await placeBid({
              discordId: interaction.user.id,
              bump: Number(spec),
            });
      await interaction.editReply(
        `Bid **${view.currentBid}** — ${view.highBidder?.name ?? "?"}`,
      );
      if (interaction.channel?.type === ChannelType.GuildText) {
        await publishLot(interaction.channel, view);
      }
    } catch (error) {
      const text = fail(error);
      try {
        if (interaction.deferred) {
          await interaction.editReply(text);
        } else {
          await interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
        }
      } catch {
        /* interaction expired */
      }
    }
    return;
  }
  if (interaction.isChatInputCommand()) {
    try {
      await handleSlash(interaction);
    } catch (error) {
      console.error("slash command", error);
    }
  }
});

client.on("error", (error) => {
  console.error("discord client", error);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (await offerPaymentTick(message)) return;
  if (await moderatePaymentsChannel(message)) return;
  if (await moderateCommandOnlyChannel(message)) return;
  await handlePrefixResult(message);
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
    await handlePaymentTick(reaction, user);
  } catch (error) {
    console.error("payment tick", error);
  }
});

async function refreshPostedLot() {
  const view = await getAuctionView();
  if (!view.channelId || !view.messageId) return;
  const channel = await client.channels.fetch(view.channelId);
  if (channel?.type === ChannelType.GuildText) {
    await publishLot(channel, view);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`Bot online as ${client.user?.tag}`);
  await hydrateAuctionClock().catch(() => undefined);
  for (const guild of client.guilds.cache.values()) {
    try {
      await syncCupChannelAccess(guild);
      await syncCaptainRolesFromDb(guild);
      console.log(`Locked #captains and #auction in ${guild.name}`);
    } catch (error) {
      console.error(`channel access (${guild.name})`, error);
    }
  }
  if (autoPostChannelRulesEnabled() && client.user) {
    for (const guild of client.guilds.cache.values()) {
      try {
        const results = await postChannelGuides(guild, client.user.id);
        const posted = results.filter((r) => r.status === "posted");
        if (posted.length > 0) {
          console.log(
            `Posted channel guides in ${guild.name}: ${posted.map((r) => r.channelName).join(", ")}`,
          );
        }
      } catch (error) {
        console.error(`channel guides (${guild.name})`, error);
      }
    }
  }
  setInterval(async () => {
    try {
      const { changed } = await tickAuction();
      if (changed) await refreshPostedLot();
    } catch (error) {
      console.error("auction tick", error);
    }
  }, 1000);
  setInterval(async () => {
    try {
      await tickMatchReminders(client);
    } catch (error) {
      console.error("match reminders", error);
    }
  }, 60_000);
  setInterval(() => {
    prisma.$queryRaw`SELECT 1`.catch(() => undefined);
  }, 120_000);
});

async function main() {
  const rest = new REST({ version: "10" }).setToken(botToken);
  if (guildId) {
    try {
      await rest.put(Routes.applicationGuildCommands(botClientId, guildId), {
        body: commands,
      });
      console.log(`Registered guild slash commands for ${guildId}`);
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code === 50001) {
        console.warn(
          "Bot is not in that server yet (Missing Access). Invite it, then restart npm run bot.",
        );
        console.warn(
          `Invite: ${botInviteUrl(botClientId)}`,
        );
      } else {
        throw error;
      }
    }
  }
  await rest.put(Routes.applicationCommands(botClientId), { body: commands });
  console.log(
    guildId
      ? "Synced global slash commands (role dropdown)"
      : "Registered global slash commands (can take up to an hour)",
  );
  await client.login(botToken);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
