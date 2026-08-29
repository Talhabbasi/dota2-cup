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
  type TextChannel,
} from "discord.js";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  adminRoleName,
  BID_INCREMENT,
  FLEX,
  isAdminDiscordId,
  MEDAL_LABELS,
  MEDALS,
  ROLE_LABELS,
  ROLES,
  STARTING_ROLES,
  STARTING_PURSE,
  type Role,
} from "../src/lib/constants";
import { registerPlayer } from "../src/lib/register";
import {
  adminAddCaptain,
  adminRemoveCaptain,
  getTeamByCaptainDiscord,
  rosterSummary,
} from "../src/lib/captains";
import {
  getAuctionView,
  pauseAuction,
  placeBid,
  saveAuctionMessage,
  skipLot,
  startAuction,
  tickAuction,
  undoLastSale,
} from "../src/lib/auction";
import { assignUnknown, ingestMatch } from "../src/lib/results";
import {
  clearScheduledFixtures,
  formatScheduleSummary,
  formatScheduleWhen,
  generateWeekendSchedule,
  listScheduledFixtures,
} from "../src/lib/schedule";
import { HELP_COMMANDS, HELP_GUIDE } from "../src/lib/help";
import { tickMatchReminders } from "../src/lib/reminders";
import { buildRulesEmbed, rulesChannelName } from "../src/lib/rules";
import {
  autoPostChannelRulesEnabled,
  formatGuideResults,
  postChannelGuides,
} from "../src/lib/post-channel-guides";
import {
  adminAddPlayerToTeam,
  adminDeletePlayer,
  adminRemovePlayerFromTeam,
  adminResyncRosterRole,
} from "../src/lib/players-admin";
import { parseRolesJson } from "../src/lib/roles";
import { prisma } from "../src/lib/prisma";
import { formatRoles } from "../src/lib/data";
import { steamProfileUrl } from "../src/lib/steam";

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
    .setDescription("Link the Steam account you will play on")
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
    ),
  new SlashCommandBuilder()
    .setName("me")
    .setDescription("Show your registration and team"),
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
      s
        .setName("delete")
        .setDescription("Admin: delete a registration (unsigned players only)")
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
          "Admin: pin a guide in #register, #captains, #auction, #results, #schedule, #general",
        )
        .addBooleanOption((o) =>
          o
            .setName("force")
            .setDescription("Post again even if a guide is already pinned"),
        ),
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
].map((c) => c.toJSON());

function isOrganizer(member: GuildMember | null, discordId: string): boolean {
  if (isAdminDiscordId(discordId)) return true;
  if (!member) return false;
  const name = adminRoleName();
  return member.roles.cache.some((r) => r.name === name);
}

function fail(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

const pendingRegister = new Map<string, { steam: string; medal: string }>();

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

function registerReplyLines(
  result: Awaited<ReturnType<typeof registerPlayer>>,
): string[] {
  const roles = formatRoles(parseRolesJson(result.player.rolesJson));
  return [
    `${result.created ? "✅ Registered" : "✅ Updated"} **${result.player.steamName}**`,
    `Profile: ${result.profileUrl}`,
    `Steam32: \`${result.player.steam32}\` · ${result.player.medal} · ${roles}`,
    result.openDotaLinked
      ? "OpenDota recognizes this account — match stats will import automatically."
      : "⚠️ OpenDota has no Dota 2 history yet for this account. Queue on this exact Steam account or stats will not count.",
  ];
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

function lotEmbed(view: Awaited<ReturnType<typeof getAuctionView>>) {
  const embed = new EmbedBuilder()
    .setColor(view.status === "running" ? 0xd4a24c : 0x6b7280)
    .setTitle(
      view.role
        ? `Auction — ${ROLE_LABELS[view.role]}`
        : "Auction idle",
    );

  if (view.currentPlayer && view.role) {
    const roles = formatRoles(parseRolesJson(view.currentPlayer.rolesJson));
    embed.addFields(
      {
        name: "Steam name",
        value: view.currentPlayer.steamName,
        inline: true,
      },
      {
        name: "Rank",
        value: MEDAL_LABELS[view.currentPlayer.medal as keyof typeof MEDAL_LABELS] ?? view.currentPlayer.medal,
        inline: true,
      },
      {
        name: "Role (this lot)",
        value: ROLE_LABELS[view.role],
        inline: true,
      },
      {
        name: "Bid price",
        value: `**${view.currentBid}**`,
        inline: true,
      },
      {
        name: "High bidder",
        value: view.highBidder?.name ?? "— none yet —",
        inline: true,
      },
      {
        name: "Clock",
        value: view.status === "paused" ? "paused" : `${view.secondsLeft}s`,
        inline: true,
      },
      { name: "Listed roles", value: roles, inline: false },
    );
    embed.setFooter({
      text: `${view.remainingInRole} still in this ${ROLE_LABELS[view.role]} queue · flex players appear in every role until sold`,
    });
  } else {
    embed.setDescription("No player on the block. Admin: `/auction start`.");
  }
  return embed;
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

async function publishLot(channel: TextChannel, view: Awaited<ReturnType<typeof getAuctionView>>) {
  const payload = {
    embeds: [lotEmbed(view)],
    components: view.status === "running" && view.currentPlayer ? [lotButtons()] : [],
  };
  if (view.messageId && view.channelId === channel.id) {
    try {
      const existing = await channel.messages.fetch(view.messageId);
      await existing.edit(payload);
      return;
    } catch {
      /* fall through */
    }
  }
  const sent = await channel.send(payload);
  await saveAuctionMessage(channel.id, sent.id);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

async function handleSlash(interaction: ChatInputCommandInteraction) {
  const name = interaction.commandName;
  const member = interaction.member as GuildMember | null;
  const discordId = interaction.user.id;
  const discordName =
    interaction.user.globalName || interaction.user.username;

  try {
    if (name === "register") {
      await interaction.deferReply();
      const steam = interaction.options.getString("steam", true);
      const medal = interaction.options.getString("rank", true);
      const role = registerRoleOption(interaction);
      if (!role) {
        pendingRegister.set(discordId, { steam, medal });
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
      });
      await interaction.editReply({
        content: registerReplyLines(result).join("\n"),
      });
      return;
    }

    if (name === "me") {
      const player = await prisma.player.findUnique({
        where: { discordId },
        include: { team: true },
      });
      if (!player) {
        await interaction.reply({
          content: "You are not registered. Use `/register`.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const roles = formatRoles(parseRolesJson(player.rolesJson));
      const sub = player.rosterRole === "sub" ? " · Sub" : "";
      const team = player.team
        ? `Team **${player.team.name}**${player.isCaptain ? " · captain" : ""}${sub}`
        : "Unsigned — you will appear in the auction";
      await interaction.reply({
        content: `**${player.steamName}** · ${player.medal} · ${roles}\nProfile: ${steamProfileUrl(player.steam32)}\nSteam32 \`${player.steam32}\`\n${team}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (name === "help") {
      await interaction.reply({
        content: `${HELP_COMMANDS}\n\n${HELP_GUIDE}`,
        flags: MessageFlags.Ephemeral,
      });
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
      const sub = interaction.options.getSubcommand();
      if (sub === "add") {
        const user = interaction.options.getUser("user", true);
        const team = await adminAddCaptain({
          discordId: user.id,
          teamName: interaction.options.getString("team", true),
        });
        await interaction.reply(
          `${user} is now captain of **${team.name}** (${STARTING_PURSE} points).`,
        );
        return;
      }
      const user = interaction.options.getUser("user", true);
      const removed = await adminRemoveCaptain(user.id);
      await interaction.reply(
        `Removed captain ${user}. **${removed.teamName}** is dissolved; players are unsigned again.`,
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
      const sub = interaction.options.getSubcommand();
      const user = interaction.options.getUser("user", true);
      if (sub === "delete") {
        const removed = await adminDeletePlayer(user.id);
        await interaction.reply(
          `Deleted registration for **${removed.name}**. They can /register again.`,
        );
        return;
      }
      if (sub === "add") {
        const result = await adminAddPlayerToTeam({
          discordId: user.id,
          teamName: interaction.options.getString("team", true),
        });
        await interaction.reply(
          `Added **${result.player.steamName}** to **${result.team.name}**.`,
        );
        return;
      }
      if (sub === "remove") {
        const removed = await adminRemovePlayerFromTeam(user.id);
        await interaction.reply(
          `Removed **${removed.name}** from **${removed.teamName}**.`,
        );
        return;
      }
      const synced = await adminResyncRosterRole(user.id);
      await interaction.reply(
        `Rebalanced **${synced.name}**'s team roster (5 starters + up to 2 subs).`,
      );
      return;
    }

    if (name === "bid") {
      const view = await placeBid({
        discordId,
        amount: interaction.options.getInteger("amount", true),
      });
      await interaction.reply({
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
      await interaction.reply({
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
        await interaction.editReply(formatGuideResults(results).join("\n"));
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
          `✅ Scheduled **${result.matchCount}** matches for **${result.teamCount}** teams (every pair once).`,
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
    (a.contentType ?? "").startsWith("image/"),
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
    await message.reply(formatMatchReply(match));
  } catch (error) {
    await message.reply(fail(error));
  }
}

client.on("interactionCreate", async (interaction: Interaction) => {
  if (interaction.isStringSelectMenu() && interaction.customId === "register:role") {
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
      });
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
      const spec = interaction.customId.slice(4);
      const view =
        spec === "open"
          ? await placeBid({ discordId: interaction.user.id })
          : await placeBid({
              discordId: interaction.user.id,
              bump: Number(spec),
            });
      await interaction.reply({
        content: `Bid **${view.currentBid}** — ${view.highBidder?.name ?? "?"}`,
      });
      if (interaction.channel?.type === ChannelType.GuildText) {
        await publishLot(interaction.channel, view);
      }
    } catch (error) {
      await interaction.reply({
        content: fail(error),
        flags: MessageFlags.Ephemeral,
      });
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
  await handlePrefixResult(message);
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
          `Invite: https://discord.com/oauth2/authorize?client_id=${botClientId}&permissions=117760&scope=bot%20applications.commands`,
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
