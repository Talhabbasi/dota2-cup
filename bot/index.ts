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
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type Guild,
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
  paymentsChannelName,
  registrationClosedDiscordReply,
  setRegistrationOpen,
} from "../src/lib/registration-status";
import {
  adminChannelName,
  botInviteUrl,
  describeDiscordChannelError,
  ensureAdminChannel,
  matchesChannelName,
  postAdminCommandHelp,
  postCupAnnouncements,
  setupCupDiscord,
  clearCupAnnouncements,
  refreshPinnedPaymentAnnouncement,
} from "../src/lib/cup-announcements";
import {
  messageHasImage,
  moderateCommandOnlyChannel,
  moderatePaymentsChannel,
} from "../src/lib/channel-moderation";
import {
  adminAddCaptain,
  adminChangeCaptain,
  adminRemoveCaptain,
  adminRenameTeam,
  getTeamByCaptainDiscord,
  listTeamNames,
  rosterSummary,
} from "../src/lib/captains";
import {
  clearAuctionMessage,
  confirmLot,
  getAuctionView,
  markAuctionAnnounced,
  patchLivePlayer,
  pauseAuction,
  placeBid,
  repairAuctionScores,
  revertSoldAuctionPlayers,
  resumeAuction,
  saveAuctionMessage,
  skipLot,
  startAuction,
  tickAuction,
  undoLastSale,
  hydrateAuctionClock,
} from "../src/lib/auction";
import {
  dummyAuctionChannelName,
  isDummyAuctionChannel,
} from "../src/lib/dummy-auction-channel";
import { notifySiteRefresh } from "../src/lib/notify-site";
import {
  adminMarkPaid,
  findTeamPaymentsByName,
  formatTeamPaymentDetail,
  formatTeamPaymentLine,
  formatTeamPaymentsList,
  formatUnpaidList,
  formatPaymentCollection,
  getPaymentCollection,
  listTeamPayments,
  listUnpaidPlayers,
  playerMustPay,
  recordPlayerPayment,
} from "../src/lib/payments";
import { assignUnknown, ingestLatestCupMatch, ingestMatch, recordManualSeriesWinner } from "../src/lib/results";
import {
  discordMessageAlreadyIngested,
  ingestScoreboardScreenshot,
} from "../src/lib/scoreboard-shot";
import {
  backfillSeason1,
  createSeason,
  formatSeasonLabel,
  getCurrentSeason,
  listSeasons,
  startSeason,
} from "../src/lib/seasons";
import {
  UPDATE_KINDS,
  type UpdateKind,
} from "../src/lib/releases";
import {
  ensureUpdatesChannel,
  postAdHocUpdate,
  postPendingReleases,
  updatesChannelName,
} from "../src/lib/updates";
import {
  clearScheduledFixtures,
  formatScheduleSummary,
  formatScheduleWhen,
  generateGrandFinal,
  generateWeekendSchedule,
  listScheduledFixtures,
} from "../src/lib/schedule";
import {
  MATCH_NIGHT_TIME_CHOICES,
  SCHEDULE_KIND_CHOICES,
  createScheduledMatch,
  deleteScheduledMatch,
  formatFixtureChoiceLabel,
  formatFixtureLine,
  listEditableFixtures,
  listTeamsForSchedule,
  upcomingWeekendDates,
  updateScheduledMatch,
} from "../src/lib/schedule-crud";
import { postGroupStageToMatches } from "../src/lib/group-stage-discord";
import { postPlayoffToMatches } from "../src/lib/playoff-discord";
import {
  bookGroupStageRoundRobin,
  bookedGroupStageFromDb,
  formatGroupStageDiscord,
} from "../src/lib/group-stage-schedule";
import {
  assignPlayoffGroup,
  clearPlayoffFixtures,
  formatPlayoffStatus,
  generatePlayoffGroupStage,
  getPlayoffView,
  openPlayoffsFromGroups,
  seedPlayoffGroups,
} from "../src/lib/playoff";
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
  tryGrantCupPlayerAccess,
  tryProvisionTeamDiscord,
  tryRenameTeamDiscordLabels,
  tryRevokeCupPlayerAccess,
  trySetMemberCaptainRole,
  trySetPlayWindowRoles,
  tryStripMemberTeamRoles,
  trySyncCupChannelAccess,
  tryTeardownTeamDiscord,
} from "../src/lib/discord-access";
import { trySetMemberRegisteredRole } from "../src/lib/payments-channel-access";
import { syncGuildIcon } from "../src/lib/guild-branding";
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
  formatUnsignedPlayers,
  listRegisteredPlayers,
  listUnsignedPlayers,
} from "../src/lib/players-admin";
import { parseRolesJson } from "../src/lib/roles";
import { prisma, keepPrismaAlive } from "../src/lib/prisma";
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
    .setDescription("Show your medal, role, and team in chat")
    .addUserOption((o) =>
      o.setName("user").setDescription("Another player (optional)"),
    ),
  new SlashCommandBuilder()
    .setName("pool")
    .setDescription("List players (except captains) with medal and role"),
  new SlashCommandBuilder()
    .setName("unsigned")
    .setDescription("List registered players who are not on a team yet"),
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
    .setDescription("Admin: appoint, change, rename, or dissolve a franchise")
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Admin: create a new team and appoint its captain")
        .addUserOption((o) =>
          o.setName("user").setDescription("Player").setRequired(true),
        )
        .addStringOption((o) =>
          o.setName("team").setDescription("New team name").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("change")
        .setDescription("Admin: swap captain — team, roster, and schedule stay")
        .addStringOption((o) =>
          o
            .setName("team")
            .setDescription("Existing team")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addUserOption((o) =>
          o.setName("user").setDescription("New captain").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("rename")
        .setDescription("Admin: rename a team only (schedule stays the same)")
        .addStringOption((o) =>
          o
            .setName("team")
            .setDescription("Current team name")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((o) =>
          o.setName("name").setDescription("New team name").setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Admin: dissolve the team (deletes franchise + roster)")
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
        .setName("unsigned")
        .setDescription("Admin: list players not on a team"),
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
          o.setName("user").setDescription("Player if they are still in Discord"),
        )
        .addStringOption((o) =>
          o
            .setName("discord_id")
            .setDescription("Discord user ID if they left the server"),
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
          o.setName("user").setDescription("Player if they are still in Discord"),
        )
        .addStringOption((o) =>
          o
            .setName("discord_id")
            .setDescription("Discord user ID if they left the server"),
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
    .setName("season")
    .setDescription("Admin: current cup season (create next season from #admin)")
    .addSubcommand((s) =>
      s.setName("current").setDescription("Admin: show which season is live"),
    )
    .addSubcommand((s) =>
      s.setName("list").setDescription("Admin: list every season"),
    )
    .addSubcommand((s) =>
      s
        .setName("create")
        .setDescription("Admin: create the next season (does not switch live data)")
        .addStringOption((o) =>
          o
            .setName("name")
            .setDescription("Display name, e.g. Season 2 (default: Season N)"),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("start")
        .setDescription("Admin: make this season live (archives the current one)")
        .addIntegerOption((o) =>
          o
            .setName("number")
            .setDescription("Season number to make live")
            .setRequired(true)
            .setMinValue(1),
        ),
    ),
  new SlashCommandBuilder()
    .setName("updates")
    .setDescription("Admin: post Added / Fixed / Removed notes to #updates")
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Admin: post one changelog line to #updates")
        .addStringOption((o) =>
          o
            .setName("kind")
            .setDescription("Added, fixed, or removed")
            .setRequired(true)
            .addChoices(
              { name: "Added", value: "added" },
              { name: "Fixed", value: "fixed" },
              { name: "Removed", value: "removed" },
            ),
        )
        .addStringOption((o) =>
          o
            .setName("text")
            .setDescription("What changed")
            .setRequired(true)
            .setMaxLength(1000),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("post")
        .setDescription("Admin: post pending changelog entries to #updates"),
    ),
  new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Admin: payments channel, #admin help, cup setup")
    .addSubcommand((s) =>
      s
        .setName("setup")
        .setDescription("Create #payments, lock cup channels, team chats, team voice, #auction-test, and #updates"),
    )
    .addSubcommand((s) =>
      s.setName("help").setDescription("Post all bot commands into #admin"),
    ),
  new SlashCommandBuilder()
    .setName("bid")
    .setDescription("Bid on the player on the block")
    .addIntegerOption((o) =>
      o.setName("amount").setDescription("Bid amount").setRequired(true).setMinValue(100),
    )
    .addStringOption((o) =>
      o
        .setName("team")
        .setDescription("TEST channel only: dummy team to bid as (Liquid / OG / Secret)"),
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
        .setDescription("Start a rank auction (#auction live, #auction-test fake)")
        .addStringOption((o) =>
          o
            .setName("rank")
            .setDescription("Medal pool — all unsigned players at this rank")
            .setRequired(true)
            .addChoices(...medalChoices),
        ),
    )
    .addSubcommand((s) =>
      s.setName("pause").setDescription("Pause the live clock"),
    )
    .addSubcommand((s) =>
      s.setName("resume").setDescription("Resume a paused auction"),
    )
    .addSubcommand((s) =>
      s.setName("skip").setDescription("Pass the current player (unsold)"),
    )
    .addSubcommand((s) =>
      s
        .setName("confirm")
        .setDescription("Sell the current player to the high bidder"),
    )
    .addSubcommand((s) =>
      s
        .setName("revert")
        .setDescription("Admin: return a sold player to the pool and refund points")
        .addUserOption((o) =>
          o.setName("user").setDescription("Sold player to return to the pool"),
        )
        .addStringOption((o) =>
          o.setName("name").setDescription("Steam name if they are not in Discord"),
        ),
    )
    .addSubcommand((s) =>
      s.setName("undo").setDescription("Undo the last sale"),
    ),
  new SlashCommandBuilder()
    .setName("schedule")
    .setDescription("Weekend match schedule (Sat/Sun)")
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Admin: book Team A vs Team B on a Saturday or Sunday")
        .addStringOption((o) =>
          o
            .setName("team_a")
            .setDescription("First team")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName("team_b")
            .setDescription("Second team")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName("date")
            .setDescription("Saturday or Sunday as YYYY-MM-DD")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName("time")
            .setDescription("Kickoff (group: 10pm–6am · playoffs: 10am–3am PKT)")
            .setRequired(true)
            .addChoices(...MATCH_NIGHT_TIME_CHOICES),
        )
        .addStringOption((o) =>
          o
            .setName("kind")
            .setDescription("Match type (default: group stage)")
            .addChoices(...SCHEDULE_KIND_CHOICES),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("edit")
        .setDescription("Admin: change teams or time on a scheduled match")
        .addStringOption((o) =>
          o
            .setName("fixture")
            .setDescription("Which match to change")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName("team_a")
            .setDescription("New first team")
            .setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName("team_b")
            .setDescription("New second team")
            .setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName("date")
            .setDescription("New Saturday or Sunday as YYYY-MM-DD")
            .setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName("time")
            .setDescription("New kickoff (group: 10pm–6am · playoffs: 10am–3am PKT)")
            .addChoices(...MATCH_NIGHT_TIME_CHOICES),
        )
        .addStringOption((o) =>
          o
            .setName("kind")
            .setDescription("Match type")
            .addChoices(...SCHEDULE_KIND_CHOICES),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Admin: delete a scheduled match")
        .addStringOption((o) =>
          o
            .setName("fixture")
            .setDescription("Which match to delete")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("groups")
        .setDescription("Admin: book Group A Saturday + Group B Sunday round-robin")
        .addStringOption((o) =>
          o
            .setName("saturday")
            .setDescription("Group A date YYYY-MM-DD (default: next Saturday)")
            .setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName("sunday")
            .setDescription("Group B date YYYY-MM-DD (default: next Sunday)")
            .setAutocomplete(true),
        )
        .addBooleanOption((o) =>
          o
            .setName("force")
            .setDescription("Replace group matches that are still scheduled"),
        ),
    )
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
    .setName("playoff")
    .setDescription("Group stage + Dota-style upper / elimination playoffs")
    .addSubcommand((s) =>
      s.setName("status").setDescription("Show groups and the playoff bracket"),
    )
    .addSubcommand((s) =>
      s
        .setName("groups")
        .setDescription("Admin: randomly split 8 teams into Group A and Group B"),
    )
    .addSubcommand((s) =>
      s
        .setName("assign")
        .setDescription("Admin: put a team in Group A or B")
        .addStringOption((o) =>
          o.setName("team").setDescription("Team name").setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("group")
            .setDescription("Group")
            .setRequired(true)
            .addChoices(
              { name: "Group A", value: "A" },
              { name: "Group B", value: "B" },
            ),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("generate")
        .setDescription("Admin: book the 4-match legacy group stage (not the round-robin)")
        .addStringOption((o) =>
          o
            .setName("friday")
            .setDescription("First Friday as YYYY-MM-DD (default: next Friday)"),
        )
        .addBooleanOption((o) =>
          o
            .setName("force")
            .setDescription("Replace playoff fixtures that are still scheduled"),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("open")
        .setDescription("Admin: book playoffs from final group standings"),
    )
    .addSubcommand((s) =>
      s
        .setName("post")
        .setDescription("Admin: post or refresh the playoff bracket in #matches"),
    )
    .addSubcommand((s) =>
      s
        .setName("clear")
        .setDescription("Admin: delete pending playoff fixtures (keeps group matches)"),
    ),
  new SlashCommandBuilder()
    .setName("result")
    .setDescription("Import a match scoreboard (heroes, items, K/D/A)")
    .addSubcommand((s) =>
      s
        .setName("match")
        .setDescription("Pull heroes/items by Match ID from the Dota 2 scoreboard (not Lobby ID)")
        .addStringOption((o) =>
          o
            .setName("match_id")
            .setDescription("Match ID from the post-game screen, or OpenDota / STRATZ link")
            .setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName("import")
        .setDescription("Admin: find the latest cup game and import heroes/items"),
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
    )
    .addSubcommand((s) =>
      s
        .setName("winner")
        .setDescription("Admin: record who won a booked match (no OpenDota needed)")
        .addStringOption((o) =>
          o
            .setName("fixture")
            .setDescription("Which scheduled match")
            .setRequired(true)
            .setAutocomplete(true),
        )
        .addStringOption((o) =>
          o
            .setName("team")
            .setDescription("Winning team")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    ),
  new SlashCommandBuilder()
    .setName("pay")
    .setDescription("Entry fees — collected money, unpaid players, team 5000 PKR")
    .addSubcommand((s) =>
      s
        .setName("collected")
        .setDescription("How much money is in, owed, and expected"),
    )
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

function memberHasAdminRole(member: GuildMember | null | undefined): boolean {
  if (!member?.roles?.cache) return false;
  const name = adminRoleName().toLowerCase();
  return member.roles.cache.some((role) => role.name.toLowerCase() === name);
}

function isOrganizer(member: GuildMember | null, discordId: string): boolean {
  if (isAdminDiscordId(discordId)) return true;
  return memberHasAdminRole(member);
}

function isOrganizerInteraction(interaction: {
  user: { id: string };
  member: unknown;
  guild: ChatInputCommandInteraction["guild"];
}): boolean {
  if (isAdminDiscordId(interaction.user.id)) return true;
  if (memberHasAdminRole(interaction.member as GuildMember | null)) {
    return true;
  }
  const guild = interaction.guild;
  if (!guild) return false;
  const adminRole = guild.roles.cache.find(
    (role) => role.name.toLowerCase() === adminRoleName().toLowerCase(),
  );
  const raw = interaction.member as { roles?: unknown } | null;
  if (!adminRole || !raw?.roles) return false;
  if (Array.isArray(raw.roles)) return raw.roles.includes(adminRole.id);
  return false;
}

function interactionChannelName(
  interaction: ChatInputCommandInteraction,
): string | null {
  const channel = interaction.channel;
  if (channel && "name" in channel && typeof channel.name === "string") {
    return channel.name;
  }
  return null;
}

function isAdminChannel(interaction: ChatInputCommandInteraction) {
  const name = interactionChannelName(interaction);
  return Boolean(name && name.toLowerCase() === adminChannelName().toLowerCase());
}

function fail(error: unknown): string {
  console.error(error);
  return publicErrorMessage(error);
}

async function handleTeamNameAutocomplete(interaction: AutocompleteInteraction) {
  const focused = interaction.options.getFocused(true);
  if (focused.name !== "team") {
    await interaction.respond([]);
    return;
  }
  const query = focused.value.trim().toLowerCase();
  const teams = await listTeamNames();
  const choices = teams
    .filter((team) => !query || team.name.toLowerCase().includes(query))
    .slice(0, 25)
    .map((team) => ({ name: team.name.slice(0, 100), value: team.name }));
  await interaction.respond(choices);
}

async function handleScheduleAutocomplete(interaction: AutocompleteInteraction) {
  if (interaction.commandName === "result") {
    const focused = interaction.options.getFocused(true);
    const query = focused.value.trim().toLowerCase();
    if (focused.name === "fixture") {
      const fixtures = await listEditableFixtures(25);
      const choices = fixtures
        .map((fixture) => ({
          name: formatFixtureChoiceLabel(fixture),
          value: fixture.id,
        }))
        .filter((row) => !query || row.name.toLowerCase().includes(query))
        .slice(0, 25);
      await interaction.respond(choices);
      return;
    }
    if (focused.name === "team") {
      const fixtureId = interaction.options.getString("fixture");
      const fixtures = await listEditableFixtures(25);
      const fixture = fixtures.find((row) => row.id === fixtureId) ?? fixtures[0];
      if (!fixture) {
        await interaction.respond([]);
        return;
      }
      const names = [fixture.radiantTeam.name, fixture.direTeam.name].filter(
        (name) => !query || name.toLowerCase().includes(query),
      );
      await interaction.respond(
        names.map((name) => ({ name: name.slice(0, 100), value: name })),
      );
      return;
    }
    await interaction.respond([]);
    return;
  }
  if (interaction.commandName !== "schedule") {
    await interaction.respond([]);
    return;
  }
  const focused = interaction.options.getFocused(true);
  const query = focused.value.trim().toLowerCase();

  if (focused.name === "team_a" || focused.name === "team_b") {
    const teams = await listTeamsForSchedule();
    const choices = teams
      .filter((team) => !query || team.name.toLowerCase().includes(query))
      .slice(0, 25)
      .map((team) => ({ name: team.name.slice(0, 100), value: team.name }));
    await interaction.respond(choices);
    return;
  }

  if (focused.name === "date" || focused.name === "saturday" || focused.name === "sunday") {
    const dates = upcomingWeekendDates(8).filter(
      (row) =>
        !query ||
        row.value.includes(query) ||
        row.name.toLowerCase().includes(query),
    );
    await interaction.respond(dates.slice(0, 25));
    return;
  }

  if (focused.name === "fixture") {
    const fixtures = await listEditableFixtures(25);
    const choices = fixtures
      .map((fixture) => ({
        name: formatFixtureChoiceLabel(fixture),
        value: fixture.id,
      }))
      .filter((row) => !query || row.name.toLowerCase().includes(query))
      .slice(0, 25);
    await interaction.respond(choices);
    return;
  }

  await interaction.respond([]);
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

function playerDiscordIdFromOptions(interaction: ChatInputCommandInteraction): string {
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

const CARD_GOLD = 0xb07d1f;

function playerSlotLabel(player: {
  isCaptain: boolean;
  rosterRole: string | null;
  teamId: string | null;
}) {
  if (player.isCaptain) return "Captain";
  if (player.rosterRole === "sub") return "Substitute";
  if (player.teamId) return "Starter";
  return "Auction pool";
}

function playerCardEmbed(
  player: {
    id: string;
    steamName: string;
    medal: string;
    rolesJson: string;
    playWindow: string;
    isCaptain: boolean;
    rosterRole: string | null;
    teamId: string | null;
    team: { name: string } | null;
  },
  discordUser: User,
) {
  const role = formatRoles(parseRolesJson(player.rolesJson));
  const window = PLAY_WINDOW_LABELS[playWindowOrBoth(player.playWindow)];
  const team = player.team?.name ?? "Unsigned";
  return new EmbedBuilder()
    .setColor(CARD_GOLD)
    .setAuthor({
      name: discordUser.globalName || discordUser.username,
      iconURL: discordUser.displayAvatarURL({ size: 64 }),
    })
    .setTitle(player.steamName)
    .setURL(playerPageUrl(player.id))
    .setThumbnail(discordUser.displayAvatarURL({ size: 256 }))
    .setDescription(`${discordUser}`)
    .addFields(
      { name: "Medal", value: medalLabel(player.medal), inline: true },
      { name: "Role", value: role, inline: true },
      { name: "Team", value: team, inline: true },
      { name: "Slot", value: playerSlotLabel(player), inline: true },
      { name: "Weekends", value: window, inline: true },
    )
    .setFooter({ text: "MM Dota Cup" });
}

async function poolEmbeds() {
  const players = await prisma.player.findMany({
    where: { isCaptain: false },
    orderBy: [{ steamName: "asc" }],
    include: { team: { select: { name: true } } },
  });
  if (players.length === 0) {
    return [
      new EmbedBuilder()
        .setColor(CARD_GOLD)
        .setTitle("Player pool")
        .setDescription("No players in the pool yet (captains are hidden).")
        .setFooter({ text: "MM Dota Cup" }),
    ];
  }

  const groups = new Map<string, string[]>();
  for (const player of players) {
    const role = formatRoles(parseRolesJson(player.rolesJson));
    const team = player.team?.name ? ` · ${player.team.name}` : "";
    const line = `• **${player.steamName}** — ${medalLabel(player.medal)}${team}`;
    const list = groups.get(role) ?? [];
    list.push(line);
    groups.set(role, list);
  }

  const embeds: EmbedBuilder[] = [];
  let current = new EmbedBuilder()
    .setColor(CARD_GOLD)
    .setTitle(`Player pool · ${players.length}`)
    .setDescription("Registered players except captains — medal and role.")
    .setFooter({ text: "MM Dota Cup" });
  let fields = 0;

  for (const [role, lines] of [...groups.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const chunks = splitDiscordChunks(lines.join("\n"), 1024);
    for (const chunk of chunks) {
      if (fields >= 25) {
        embeds.push(current);
        current = new EmbedBuilder()
          .setColor(CARD_GOLD)
          .setTitle("Player pool")
          .setFooter({ text: "MM Dota Cup" });
        fields = 0;
      }
      current.addFields({ name: role, value: chunk, inline: false });
      fields += 1;
    }
  }
  embeds.push(current);
  return embeds;
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

function channelNameOf(channel: unknown): string | null {
  if (
    channel &&
    typeof channel === "object" &&
    "name" in channel &&
    typeof channel.name === "string"
  ) {
    return channel.name;
  }
  return null;
}

function sandboxFromChannel(channel: unknown) {
  return isDummyAuctionChannel(channelNameOf(channel));
}

function lotEmbed(view: ReturnType<typeof getAuctionView>) {
  const embed = new EmbedBuilder()
    .setColor(view.status === "running" ? 0xd4a24c : 0x6b7280)
    .setTitle(
      view.medal
        ? `${view.sandbox ? "TEST · " : ""}ON THE BLOCK — ${medalLabel(view.medal).toUpperCase()}`
        : view.sandbox
          ? "Test auction idle"
          : "Auction idle",
    );

  if (view.currentPlayer && view.medal) {
    const roles = formatRoles(parseRolesJson(view.currentPlayer.rolesJson));
    embed.addFields(
      {
        name: "Player",
        value: `**${view.currentPlayer.steamName}**`,
        inline: true,
      },
      {
        name: "Rank",
        value: medalLabel(view.currentPlayer.medal),
        inline: true,
      },
      {
        name: "Listed roles",
        value: roles,
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
            ? "paused — resume, Confirm, or Skip"
            : view.awaitingDecision
              ? view.highBidder
                ? "Ended — Admin: Confirm or Skip"
                : "Ended — Admin: Skip (no bid)"
              : view.status === "running" && view.endsAt && view.secondsLeft > 0
                ? `<t:${Math.floor(view.endsAt.getTime() / 1000)}:R>`
                : "Ended",
        inline: true,
      },
    );
    embed.setFooter({
      text: `${view.remainingInPool} still in the ${medalLabel(view.medal)} queue`,
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
      .setTitle(view.sandbox ? "SOLD (TEST)" : "SOLD")
      .setDescription(
        `**${sale.playerName}** joins **${sale.teamName}** for **${sale.price}**`,
      )
      .addFields(
        {
          name: "Rank",
          value: medalLabel(sale.medal),
          inline: true,
        },
        {
          name: "Listed roles",
          value: formatRoles(parseRolesJson(sale.rolesJson)),
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
    .setTitle(view.sandbox ? "UNSOLD (TEST)" : "UNSOLD")
    .setDescription(`**${sale.playerName}** goes back to the pool.`)
    .addFields(
      {
        name: "Rank",
        value: medalLabel(sale.medal),
        inline: true,
      },
      {
        name: "Team purses",
        value: purseLines(balances),
      },
    );
}

function doneEmbed(view: ReturnType<typeof getAuctionView>) {
  const medal = view.lastSale?.medal ?? view.medal;
  const label = medal ? medalLabel(medal) : null;
  return new EmbedBuilder()
    .setColor(0x6366f1)
    .setTitle(view.sandbox ? "Test auction complete" : "Auction complete")
    .setDescription(
      label
        ? view.sandbox
          ? `The **TEST ${label}** queue is finished. Live cup data was not changed.`
          : `The **${label}** queue is finished.`
        : view.sandbox
          ? "This test queue is finished. Live cup data was not changed."
          : "This rank queue is finished.",
    );
}

function lotActionRows(view: ReturnType<typeof getAuctionView>) {
  const lotId = view.lotId ?? "none";
  const canBid =
    view.status === "running" &&
    !view.awaitingDecision &&
    Boolean(view.currentPlayer);
  const canAct =
    Boolean(view.currentPlayer) &&
    (view.status === "running" || view.status === "paused");
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`bid:open:${lotId}`)
        .setLabel("Bid (open / +0)")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canBid),
      new ButtonBuilder()
        .setCustomId(`bid:${BID_INCREMENT}:${lotId}`)
        .setLabel(`+${BID_INCREMENT}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!canBid),
      new ButtonBuilder()
        .setCustomId(`bid:500:${lotId}`)
        .setLabel("+500")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!canBid),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`lot:skip:${lotId}`)
        .setLabel("Skip")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!canAct),
      new ButtonBuilder()
        .setCustomId(`lot:confirm:${lotId}`)
        .setLabel("Admin Confirm")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!canAct || !view.highBidder),
    ),
  ];
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
    components:
      view.currentPlayer && (view.status === "running" || view.status === "paused")
        ? lotActionRows(view)
        : [],
  });
  saveAuctionMessage(channel.id, sent.id, view.sandbox);
}

async function publishLot(channel: TextChannel, view: ReturnType<typeof getAuctionView>) {
  if (view.event === "sold" || view.event === "unsold" || view.event === "done") {
    await closeLotMessage(
      channel,
      view.messageId,
      view.event === "sold" ? "Sold" : view.event === "unsold" ? "Unsold" : "Ended",
    );
    clearAuctionMessage(view.sandbox);
    await channel.send({ embeds: [saleEmbed(view)] });
    if (view.event === "done" || !view.currentPlayer) {
      await channel.send({ embeds: [doneEmbed(view)] });
      markAuctionAnnounced(view.sandbox);
      return;
    }
    await postNewLot(channel, view);
    markAuctionAnnounced(view.sandbox);
    return;
  }

  if (view.event === "lot" || !view.messageId || view.channelId !== channel.id) {
    await closeLotMessage(channel, view.messageId);
    clearAuctionMessage(view.sandbox);
    await postNewLot(channel, view);
    markAuctionAnnounced(view.sandbox);
    return;
  }

  try {
    const existing = await channel.messages.fetch(view.messageId);
    await existing.edit({
      embeds: [lotEmbed(view)],
      components:
      view.currentPlayer && (view.status === "running" || view.status === "paused")
        ? lotActionRows(view)
        : [],
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
      await trySetMemberRegisteredRole(interaction.guild, discordId, true);
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
      const target = interaction.options.getUser("user") ?? interaction.user;
      await interaction.deferReply();
      const player = await prisma.player.findFirst({
        where: {
          OR: [
            { discordId: target.id },
            { discordId: { startsWith: `${target.id}:` } },
          ],
        },
        include: { team: { select: { name: true } } },
      });
      if (!player) {
        await interaction.editReply({
          content:
            target.id === interaction.user.id
              ? (await isRegistrationOpen())
                ? "You are not registered. Use `/register`."
                : "You are not registered. Public sign-ups are closed — ask an admin to `/player register` you."
              : `${target} is not registered in MM Dota Cup.`,
        });
        return;
      }
      await interaction.editReply({
        embeds: [playerCardEmbed(player, target)],
      });
      return;
    }

    if (name === "pool") {
      await interaction.deferReply();
      const embeds = await poolEmbeds();
      await interaction.editReply({ embeds: embeds.slice(0, 10) });
      return;
    }

    if (name === "unsigned") {
      await interaction.deferReply();
      const unsigned = await listUnsignedPlayers();
      await editReplyChunks(interaction, formatUnsignedPlayers(unsigned));
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

    if (name === "season") {
      if (!isOrganizer(member, discordId)) {
        await interaction.reply({
          content: `Only **${adminRoleName()}** can manage seasons.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!isAdminChannel(interaction)) {
        await interaction.reply({
          content: `Run \`/season\` in **#${adminChannelName()}**.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const sub = interaction.options.getSubcommand();
      await interaction.deferReply();
      try {
        if (sub === "create") {
          const created = await createSeason({
            name: interaction.options.getString("name"),
          });
          const current = await getCurrentSeason();
          await interaction.editReply(
            `Created **${formatSeasonLabel(created)}**.\nLive season is still **${current ? formatSeasonLabel(current) : "unset"}**. Creating a season does not move teams or players.`,
          );
          return;
        }
        if (sub === "start") {
          const number = interaction.options.getInteger("number", true);
          const switched = await startSeason(number);
          await interaction.editReply(
            [
              `Live season is now **${formatSeasonLabel(switched.current)}**.`,
              switched.previous
                ? `Archived **${formatSeasonLabel(switched.previous)}** (history kept).`
                : null,
              "Old teams stay on the archived season. Appoint captains again for the new cup, then `/admin setup`.",
            ]
              .filter(Boolean)
              .join("\n"),
          );
          void notifySiteRefresh();
          return;
        }
        const [current, seasons] = await Promise.all([
          getCurrentSeason(),
          listSeasons(),
        ]);
        if (seasons.length === 0) {
          await interaction.editReply("No seasons yet. Wait for the bot to finish startup, then try again.");
          return;
        }
        const lines = seasons.map((season) => {
          const mark = current?.id === season.id ? " ← live" : "";
          return `• ${formatSeasonLabel(season)}${mark}`;
        });
        if (sub === "current") {
          await interaction.editReply(
            current
              ? `Live season: **${formatSeasonLabel(current)}**.`
              : `No live season pointer.\n${lines.join("\n")}`,
          );
          return;
        }
        await interaction.editReply(`**Seasons**\n${lines.join("\n")}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not update seasons.";
        await interaction.editReply(message);
      }
      return;
    }

    if (name === "updates") {
      if (!isOrganizer(member, discordId)) {
        await interaction.reply({
          content: `Only **${adminRoleName()}** can post to #${updatesChannelName()}.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (!isAdminChannel(interaction)) {
        await interaction.reply({
          content: `Run \`/updates\` in **#${adminChannelName()}**. Notes are posted to **#${updatesChannelName()}** (Admin only).`,
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
      const sub = interaction.options.getSubcommand();
      await interaction.deferReply();
      try {
        if (sub === "add") {
          const kindRaw = interaction.options.getString("kind", true);
          const kind = (UPDATE_KINDS as readonly string[]).includes(kindRaw)
            ? (kindRaw as UpdateKind)
            : null;
          const text = interaction.options.getString("text", true).trim();
          if (!kind) {
            await interaction.editReply("Kind must be added, fixed, or removed.");
            return;
          }
          if (!text) {
            await interaction.editReply("Write what changed.");
            return;
          }
          const posted = await postAdHocUpdate(interaction.guild, {
            kind,
            text,
            author: interaction.user.username,
          });
          await interaction.editReply(
            `Posted **${kind}** in ${posted.channel}.`,
          );
          return;
        }
        const channel = await ensureUpdatesChannel(interaction.guild);
        const posted = await postPendingReleases(interaction.guild);
        const fresh = posted.filter((row) => !row.skipped).length;
        await interaction.editReply(
          fresh > 0
            ? `Posted **${fresh}** changelog ${fresh === 1 ? "entry" : "entries"} in ${channel}.`
            : `No new changelog entries. ${channel} is Admin-only.`,
        );
      } catch (error) {
        await interaction.editReply(
          error instanceof Error ? error.message : "Could not post updates.",
        );
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
        ? `\n\nIf **#${paymentsChannelName()}** is missing, the bot needs **Manage Channels**. Re-invite:\n${botInviteUrl(botClientId)}\nOr create a text channel named **${paymentsChannelName()}**, then run \`/admin setup\` again.`
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
        const captain = team.players.find((p) => p.isCaptain);
        await tryGrantCupPlayerAccess(
          interaction.guild,
          user.id,
          captain?.playWindow,
        );
        const roleNote = await trySetMemberCaptainRole(
          interaction.guild,
          user.id,
          true,
        );
        await tryProvisionTeamDiscord(interaction.guild, team);
        void notifySiteRefresh();
        await interaction.editReply(
          [
            `${user} is now captain of **${team.name}** (${STARTING_PURSE} points).`,
            roleNote ??
              "They got the team role, registered-player access, **#captains**, and their private team chat.",
          ].join("\n"),
        );
        return;
      }
      if (sub === "change") {
        const user = interaction.options.getUser("user", true);
        const changed = await adminChangeCaptain({
          discordId: user.id,
          teamName: interaction.options.getString("team", true),
        });
        if (changed.joinedRoster) {
          await tryGrantCupPlayerAccess(
            interaction.guild,
            user.id,
            changed.nextCaptain.playWindow,
          );
        }
        const oldId = changed.previousCaptain?.discordId.split(":")[0];
        const newId = changed.nextCaptain.discordId.split(":")[0];
        const notes: string[] = [];
        if (oldId && oldId !== newId) {
          const oldNote = await trySetMemberCaptainRole(
            interaction.guild,
            oldId,
            false,
          );
          if (oldNote) notes.push(oldNote);
        }
        const newNote = await trySetMemberCaptainRole(
          interaction.guild,
          newId,
          true,
        );
        if (newNote) notes.push(newNote);
        await tryProvisionTeamDiscord(interaction.guild, changed.team);
        void notifySiteRefresh();
        const prev = changed.previousCaptain
          ? ` Previous captain **${changed.previousCaptain.steamName}** stays on the roster.`
          : "";
        const joined = changed.joinedRoster
          ? ` ${user} was unsigned and is now on **${changed.team.name}**.`
          : "";
        await interaction.editReply(
          [
            `${user} is now captain of **${changed.team.name}**. Roster, purse, group, and scheduled matches are unchanged.${prev}${joined}`,
            ...notes,
          ].join("\n"),
        );
        return;
      }
      if (sub === "rename") {
        const renamed = await adminRenameTeam({
          teamName: interaction.options.getString("team", true),
          newName: interaction.options.getString("name", true),
        });
        const renameNote = await tryRenameTeamDiscordLabels(
          interaction.guild,
          renamed.oldName,
          renamed.newName,
          renamed.captainName,
        );
        void notifySiteRefresh();
        await interaction.editReply(
          [
            `**${renamed.oldName}** is now **${renamed.newName}**. Scheduled matches, opponents, and times are the same — only the name changed.`,
            renameNote,
          ]
            .filter(Boolean)
            .join("\n"),
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
      await tryTeardownTeamDiscord(
        interaction.guild,
        removed.teamName,
        removed.rosterDiscordIds,
      );
      void notifySiteRefresh();
      await interaction.editReply(
        [
          `Removed captain ${user}. **${removed.teamName}** is dissolved; players are unsigned again and lost that team's Discord role and private chat. To keep a team, use \`/captain change\` instead.`,
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
      if (sub === "unsigned") {
        const unsigned = await listUnsignedPlayers();
        await editReplyChunks(interaction, formatUnsignedPlayers(unsigned));
        return;
      }
      if (sub === "dummy") {
        const count = interaction.options.getInteger("count", true);
        const result = await adminCreateDummyPlayers(count);
        await interaction.editReply(
          `Created **${result.created.length}** dummy players:\n${result.created.map((n) => `• ${n}`).join("\n")}\nThey are for Discord auction testing only and do not appear on the website.`,
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
        await trySyncCupChannelAccess(interaction.guild);
        const body = result.created
          .map((t) => `• **${t.name}** — ${t.players.length}/7`)
          .join("\n");
        await interaction.editReply(
          `Created **${result.created.length}** dummy teams:\n${body}\nThey stay off the website. Next: \`/schedule generate\` when every team has 5+ players.`,
        );
        return;
      }
      if (sub === "dummy-teams-clear") {
        const result = await adminClearDummyTeams();
        await trySyncCupChannelAccess(interaction.guild);
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
        await trySetMemberRegisteredRole(interaction.guild, user.id, true);
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
        const targetId = playerDiscordIdFromOptions(interaction);
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
            "If this rank's auction is already running, `/auction start` that pool again so they appear in the right queue.",
          );
        } else if (live.bidReset) {
          lines.push("Live auction start price was updated (no bid yet).");
        }
        await interaction.editReply(lines.join("\n"));
        return;
      }
      if (sub === "delete" || sub === "remove" || sub === "add" || sub === "resync") {
        if (sub === "add") {
          const user = interaction.options.getUser("user", true);
          const result = await adminAddPlayerToTeam({
            discordId: user.id,
            teamName: interaction.options.getString("team", true),
          });
          await tryGrantCupPlayerAccess(
            interaction.guild,
            user.id,
            result.player.playWindow,
          );
          await tryProvisionTeamDiscord(interaction.guild, result.team);
          await interaction.editReply(
            `Added **${result.player.steamName}** to **${result.team.name}**. They can see that team's private chat and have the same registered-player roles as everyone else.`,
          );
          return;
        }
        const targetId = playerDiscordIdFromOptions(interaction);
        if (sub === "delete") {
          const removed = await adminDeletePlayer(targetId);
          await tryRevokeCupPlayerAccess(interaction.guild, targetId);
          if (removed.remainingTeam) {
            await tryProvisionTeamDiscord(interaction.guild, removed.remainingTeam);
          }
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
        if (sub === "remove") {
          const removed = await adminRemovePlayerFromTeam(targetId);
          await tryStripMemberTeamRoles(interaction.guild, targetId);
          await tryProvisionTeamDiscord(interaction.guild, removed.team);
          await interaction.editReply(
            `Removed **${removed.name}** from **${removed.teamName}**. Their team Discord role and private chat access are gone (registration kept).`,
          );
          return;
        }
        const synced = await adminResyncRosterRole(targetId);
        await interaction.editReply(
          `Rebalanced **${synced.name}**'s team roster (5 starters + up to 2 subs).`,
        );
        return;
      }
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
        const collection = await getPaymentCollection();
        await interaction.editReply(
          `${
            result.alreadyPaid
              ? `${user} was already marked paid.${teamNote}`
              : `Marked ${user} paid **${formatEntryFee()}**.${teamNote}`
          }\n**Collected: ${collection.collected.toLocaleString("en-PK")} PKR** (${collection.paidCount} paid · ${collection.unpaidCount} still owe).`,
        );
        return;
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (sub === "collected") {
        const data = await getPaymentCollection();
        await editReplyChunks(interaction, formatPaymentCollection(data));
        return;
      }
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
      const sandbox = sandboxFromChannel(interaction.channel);
      if (sandbox && !isOrganizer(member, discordId)) {
        await interaction.reply({
          content: `Only **${adminRoleName()}** can bid in **#${dummyAuctionChannelName()}**.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply();
      const view = await placeBid({
        discordId,
        amount: interaction.options.getInteger("amount", true),
        sandbox,
        teamName: interaction.options.getString("team"),
      });
      await interaction.editReply({
        content: `${sandbox ? "TEST bid " : "Bid "}**${view.currentBid}** from ${view.highBidder?.name ?? "?"} on **${view.currentPlayer?.steamName}**.`,
      });
      if (interaction.channel?.type === ChannelType.GuildText) {
        await publishLot(interaction.channel, view);
      }
      return;
    }

    if (name === "purse") {
      const sandbox = sandboxFromChannel(interaction.channel);
      if (sandbox) {
        const view = getAuctionView(true);
        await interaction.reply({
          content:
            view.teamBalances.length === 0
              ? `No test auction running. In **#${dummyAuctionChannelName()}** run \`/auction start\`.`
              : `**TEST purses** (not live)\n${purseLines(view.teamBalances)}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const { team } = await getTeamByCaptainDiscord(discordId);
      await interaction.reply({
        content: `**${team.name}** has **${team.purse}** / ${STARTING_PURSE} points.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (name === "roster") {
      if (sandboxFromChannel(interaction.channel)) {
        const view = getAuctionView(true);
        await interaction.reply({
          content:
            view.teamBalances.length === 0
              ? `No test auction running. In **#${dummyAuctionChannelName()}** run \`/auction start\`.`
              : `**TEST rosters** (not live)\n${purseLines(view.teamBalances)}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
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
      const sandbox = sandboxFromChannel(interaction.channel);
      const sub = interaction.options.getSubcommand();
      let view;
      if (sub === "start") {
        view = await startAuction(interaction.options.getString("rank", true), {
          sandbox,
        });
      } else if (sub === "pause") {
        view = await pauseAuction({ sandbox });
      } else if (sub === "resume") {
        view = await resumeAuction({ sandbox });
      } else if (sub === "skip") {
        view = await skipLot({ sandbox });
      } else if (sub === "confirm") {
        view = await confirmLot({ sandbox });
      } else if (sub === "revert") {
        const user = interaction.options.getUser("user");
        const nameOpt = interaction.options.getString("name");
        let steamName = nameOpt?.trim() ?? "";
        if (user) {
          const registered = await prisma.player.findFirst({
            where: {
              OR: [
                { discordId: user.id },
                { discordId: { startsWith: `${user.id}:` } },
              ],
            },
            select: { steamName: true },
          });
          if (!registered) {
            throw new Error(`${user} is not a registered player.`);
          }
          steamName = registered.steamName;
        }
        if (!steamName) {
          throw new Error("Pick `user:` or type `name:` (Steam name).");
        }
        const result = await revertSoldAuctionPlayers([steamName]);
        void notifySiteRefresh();
        if (!sandbox) {
          await trySyncCupChannelAccess(interaction.guild);
        }
        const row = result.reverted[0];
        await interaction.editReply({
          content: row
            ? `Reverted **${row.steamName}** from **${row.fromTeam}**. Refunded **${row.refunded}** points. They are unsigned again — start that rank pool to auction them.`
            : "Nothing to revert.",
        });
        return;
      } else {
        view = await undoLastSale();
      }
      await interaction.editReply({
        content:
          sub === "start"
            ? sandbox
              ? `Started **TEST ${medalLabel(view.medal ?? "")}** auction in **#${dummyAuctionChannelName()}**. Live cup data will not change.`
              : `Started **${medalLabel(view.medal ?? "")}** auction.`
            : sandbox
              ? `Test auction ${sub}.`
              : `Auction ${sub}.`,
      });
      if (interaction.channel?.type === ChannelType.GuildText) {
        await publishLot(interaction.channel, view);
      }
      if (
        !sandbox &&
        (sub === "confirm" || sub === "undo")
      ) {
        await trySyncCupChannelAccess(interaction.guild);
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
          access = `\n\n⚠️ Could not lock cup channels. Give the bot **Manage Channels** and **Manage Roles**.`;
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
          `Cleared old copies, then posted **one** set.\n${body}\n\n**#general:** registration closed + indoor tournament\n**#${paymentsChannelName()}:** payment rules`,
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
              ? "No fixtures scheduled. Admin: `/schedule add` (Sat/Sun) or `/schedule groups`."
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
      if (sub === "add") {
        await interaction.deferReply();
        const fixture = await createScheduledMatch({
          teamA: interaction.options.getString("team_a", true),
          teamB: interaction.options.getString("team_b", true),
          date: interaction.options.getString("date", true),
          time: interaction.options.getString("time", true),
          kind: interaction.options.getString("kind") ?? undefined,
        });
        void notifySiteRefresh();
        await interaction.editReply(
          `Scheduled ${formatFixtureLine(fixture)}.\nShown on the website **Schedule** page.`,
        );
        return;
      }
      if (sub === "edit") {
        await interaction.deferReply();
        const fixture = await updateScheduledMatch({
          fixtureId: interaction.options.getString("fixture", true),
          teamA: interaction.options.getString("team_a"),
          teamB: interaction.options.getString("team_b"),
          date: interaction.options.getString("date"),
          time: interaction.options.getString("time"),
          kind: interaction.options.getString("kind"),
        });
        void notifySiteRefresh();
        await interaction.editReply(`Updated ${formatFixtureLine(fixture)}.`);
        return;
      }
      if (sub === "remove") {
        await interaction.deferReply();
        const fixture = await deleteScheduledMatch(
          interaction.options.getString("fixture", true),
        );
        void notifySiteRefresh();
        await interaction.editReply(
          `Removed **${fixture.radiantTeam.name}** vs **${fixture.direTeam.name}** (${formatScheduleWhen(fixture.scheduledAt)}).`,
        );
        return;
      }
      if (sub === "groups") {
        await interaction.deferReply();
        const result = await bookGroupStageRoundRobin({
          saturday: interaction.options.getString("saturday") ?? undefined,
          sunday: interaction.options.getString("sunday") ?? undefined,
          force: interaction.options.getBoolean("force") ?? false,
        });
        void notifySiteRefresh();
        let posted = "";
        if (interaction.guild) {
          try {
            const post = await postGroupStageToMatches(
              interaction.guild,
              result,
              { botUserId: client.user?.id, force: true },
            );
            posted = `\nPosted in ${post.channel}.`;
          } catch (error) {
            posted = `\nBooked, but could not post in **#${matchesChannelName()}**: ${error instanceof Error ? error.message : "need Manage Channels"}.`;
          }
        }
        await interaction.editReply(
          `${formatGroupStageDiscord(result)}${posted}`,
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

    if (name === "playoff") {
      const sub = interaction.options.getSubcommand();
      if (sub === "status") {
        const view = await getPlayoffView();
        const chunks = splitDiscordChunks(formatPlayoffStatus(view));
        await interaction.reply({ content: chunks[0] });
        for (const chunk of chunks.slice(1)) {
          await interaction.followUp({ content: chunk });
        }
        return;
      }
      if (!isOrganizer(member, discordId)) {
        await interaction.reply({
          content: `Only **${adminRoleName()}** can manage playoffs.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      if (sub === "clear") {
        const n = await clearPlayoffFixtures();
        await interaction.reply(
          n === 0
            ? "No pending playoff fixtures to clear. Group matches are never removed by this command."
            : `Cleared **${n}** pending playoff fixtures. Group matches were left in place.`,
        );
        return;
      }
      if (sub === "open") {
        await interaction.deferReply();
        const result = await openPlayoffsFromGroups();
        const view = await getPlayoffView();
        if (interaction.guild) {
          await postPlayoffToMatches(interaction.guild, {
            botUserId: interaction.client.user?.id,
            force: true,
          });
        }
        void notifySiteRefresh();
        const chunks = splitDiscordChunks(
          [
            result.created.length
              ? `Playoffs opened. Booked **${result.created.length}** match(es): ${result.created.join(", ")}.`
              : "Playoff slots that are already unlocked were already booked.",
            "4th in each group is eliminated. Advancement is A3 vs B3 (Bo1). Grand Final is Bo3.",
            "",
            formatPlayoffStatus(view),
          ].join("\n"),
        );
        await interaction.editReply({ content: chunks[0] });
        for (const chunk of chunks.slice(1)) {
          await interaction.followUp({ content: chunk });
        }
        return;
      }
      if (sub === "post") {
        if (!interaction.guild) {
          await interaction.reply({
            content: "Run this in the cup server.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await interaction.deferReply();
        const post = await postPlayoffToMatches(interaction.guild, {
          botUserId: interaction.client.user?.id,
          force: true,
        });
        await interaction.editReply(
          post.posted
            ? `Posted the playoff bracket in ${post.channel}.`
            : post.updated
              ? `Updated the pinned playoff bracket in ${post.channel}.`
              : "Nothing to post yet — finish the group stage first.",
        );
        return;
      }
      if (sub === "assign") {
        const result = await assignPlayoffGroup({
          teamName: interaction.options.getString("team", true),
          group: interaction.options.getString("group", true) as "A" | "B",
        });
        await interaction.reply(
          `**${result.teamName}** is now in **Group ${result.group}**.`,
        );
        return;
      }
      if (sub === "groups") {
        await interaction.deferReply();
        const view = await seedPlayoffGroups();
        await interaction.editReply({
          content: [
            "Randomly split **8** teams into Group A and Group B.",
            "Next: `/playoff generate` to book the 4 group matches.",
            "",
            formatPlayoffStatus(view),
          ].join("\n"),
        });
        return;
      }
      await interaction.deferReply();
      const result = await generatePlayoffGroupStage({
        friday: interaction.options.getString("friday") ?? undefined,
        force: interaction.options.getBoolean("force") ?? false,
      });
      const preview = result.fixtures
        .map(
          (f) =>
            `• ${formatScheduleWhen(f.scheduledAt)} — **${f.radiantTeam.name}** vs **${f.direTeam.name}**`,
        )
        .join("\n");
      await interaction.editReply({
        content: [
          "Group stage booked — each team plays **1** best-of-1.",
          "Match 1 winners go to the **upper bracket**. Match 2 winners play **elimination**.",
          "Upper winner goes to the **Bo3 final**. Upper loser plays the elimination winner.",
          preview,
        ].join("\n"),
      });
      return;
    }

    if (name === "result") {
      const sub = interaction.options.getSubcommand();
      if (sub === "winner") {
        if (!isOrganizer(member, discordId)) {
          await interaction.reply({
            content: "Only an admin can record a match winner.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await interaction.deferReply();
        const recorded = await recordManualSeriesWinner({
          fixtureId: interaction.options.getString("fixture", true),
          winnerName: interaction.options.getString("team", true),
        });
        void notifySiteRefresh();
        await interaction.editReply(
          `Recorded **${recorded.winner}** beat **${
            recorded.winner === recorded.radiant ? recorded.dire : recorded.radiant
          }** (${recorded.radiant} vs ${recorded.dire}).\nSchedule, standings, and predictions are updated. Heroes and items are **not** in yet — copy **Match ID** from the Dota 2 post-game scoreboard (not Lobby ID) and post \`!result 8123456789\`, or use \`/result import\`.`,
        );
        if (interaction.guild) {
          await syncPlayoffMatchesChannel(interaction.guild);
        }
        return;
      }
      if (sub === "import") {
        if (!isOrganizer(member, discordId)) {
          await interaction.reply({
            content: "Only an admin can import match stats.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await interaction.deferReply();
        const match = await ingestLatestCupMatch();
        void notifySiteRefresh();
        await interaction.editReply(formatMatchReply(match));
        if (interaction.guild) {
          await syncPlayoffMatchesChannel(interaction.guild);
        }
        return;
      }
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
      if (interaction.guild) {
        await syncPlayoffMatchesChannel(interaction.guild);
      }
      return;
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
    const name = p.player?.steamName
      ?? (p.boardName?.trim()
        ? `${p.boardName.trim()} (stand-in)`
        : `unknown ${p.steam32} (stand-in)`);
    return `${p.side === "radiant" ? "R" : "D"} ${name} — ${p.hero} ${p.kills}/${p.deaths}/${p.assists} LH ${p.lastHits}`;
  });
  return [
    `Match \`${match.openDotaId}\` imported. **${winner}** beat ${match.radiantWin ? dire : radiant}.`,
    `${radiant} vs ${dire}`,
    unknown ? `${unknown} unknown Steam account(s) — admin can \`/result assign\`.` : "All 10 players mapped.",
    lines.join("\n"),
  ].join("\n");
}

async function syncPlayoffMatchesChannel(guild: import("discord.js").Guild) {
  try {
    await postPlayoffToMatches(guild, { botUserId: client.user?.id });
  } catch (error) {
    console.warn(
      `playoff #matches sync (${guild.name})`,
      error instanceof Error ? error.message : error,
    );
  }
}

async function saveMatchImage(message: Message, matchHint: string) {
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
  return {
    buffer: buf,
    mime: image.contentType || (ext === ".png" ? "image/png" : "image/jpeg"),
    screenshotPath: `/uploads/matches/${file}`,
  };
}

function resultsChannelName() {
  return process.env.RESULTS_CHANNEL_NAME?.trim() || "results";
}

function isResultsChannel(message: Message) {
  return (
    message.channel.type === ChannelType.GuildText &&
    message.channel.name.toLowerCase() === resultsChannelName().toLowerCase()
  );
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
    const collection = await getPaymentCollection();
    await message.reply(
      `✅ Admin confirmed **${formatEntryFee()}** for ${target} (**${result.player.steamName}**).${teamLine}\n**Collected: ${collection.collected.toLocaleString("en-PK")} PKR** (${collection.paidCount} paid · ${collection.unpaidCount} still owe).`,
    );
  } catch (error) {
    await message.reply(fail(error));
  }
}

function resultsImageAttachment(message: Message) {
  return message.attachments.find(
    (a) =>
      (a.contentType ?? "").startsWith("image/") ||
      /\.(png|jpe?g|webp|gif)$/i.test(a.name ?? ""),
  );
}

function botAlreadyCheckedResults(message: Message) {
  return message.reactions.cache.some(
    (reaction) => reaction.emoji.name === "✅" && reaction.me,
  );
}

function isBotMatchImportReply(message: Message, botId: string) {
  return (
    message.author.id === botId &&
    Boolean(message.reference?.messageId) &&
    /imported\./i.test(message.content)
  );
}

async function fetchResultsHistory(channel: TextChannel, max = 150) {
  const out: Message[] = [];
  let before: string | undefined;
  while (out.length < max) {
    const batch = await channel.messages.fetch({
      limit: Math.min(100, max - out.length),
      before,
    });
    if (batch.size === 0) break;
    out.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }
  return out;
}

async function ingestScreenshotFromMessage(
  message: Message,
  hint: string,
  options?: { reply?: boolean },
) {
  const shot = await saveMatchImage(message, hint);
  if (!shot) return null;
  const result = await ingestScoreboardScreenshot({
    buffer: shot.buffer,
    mime: shot.mime,
    screenshotPath: shot.screenshotPath,
    sourceId: message.id,
  });
  void notifySiteRefresh();
  if (options?.reply !== false) {
    await message.reply(formatMatchReply(result.match));
  }
  if (message.guild) await syncPlayoffMatchesChannel(message.guild);
  return result;
}

async function backfillResultsChannel(guild: Guild) {
  const channel = findTextChannel(guild, resultsChannelName());
  if (!channel) {
    console.warn(`No #${resultsChannelName()} in ${guild.name}`);
    return;
  }
  const botId = client.user?.id;
  if (!botId) return;

  console.log(`Checking #${resultsChannelName()} in ${guild.name} for missing matches…`);
  const history = await fetchResultsHistory(channel);
  const alreadyReplied = new Set(
    history
      .filter((m) => isBotMatchImportReply(m, botId))
      .map((m) => m.reference?.messageId)
      .filter((id): id is string => Boolean(id)),
  );
  const shots = history
    .filter((m) => !m.author.bot && resultsImageAttachment(m))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  console.log(
    `#${resultsChannelName()} has ${shots.length} screenshot${shots.length === 1 ? "" : "s"} to review`,
  );

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const message of shots) {
    if (alreadyReplied.has(message.id) || botAlreadyCheckedResults(message)) {
      skipped += 1;
      continue;
    }
    if (await discordMessageAlreadyIngested(message.id)) {
      skipped += 1;
      continue;
    }
    try {
      console.log(`Ingesting #results screenshot ${message.id}…`);
      const result = await ingestScreenshotFromMessage(
        message,
        `shot-${message.id}`,
        { reply: false },
      );
      if (result) {
        if (result.created) added += 1;
        else skipped += 1;
        await message.react("✅").catch(() => undefined);
      }
    } catch (error) {
      failed += 1;
      console.warn(
        `results backfill ${message.id}:`,
        error instanceof Error ? error.message : error,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  console.log(
    `#${resultsChannelName()} catch-up (${guild.name}): added ${added}, skipped ${skipped}, failed ${failed}`,
  );
  if (added > 0) {
    await channel.send(
      `Caught up #${resultsChannelName()}: added **${added}** match${added === 1 ? "" : "es"} that were missing from the site.`,
    );
  }
}

async function handlePrefixResult(message: Message) {
  const text = message.content.trim();
  if (!/^!result\b/i.test(text) && !/opendota\.com\/matches\/\d+/i.test(text)) {
    return;
  }
  const raw = text.replace(/^!result\s+/i, "").trim();
  const hasId =
    /\d{8,12}/.test(raw) || /opendota\.com\/matches\/\d+/i.test(text);
  const hint = raw.match(/\d{8,12}/)?.[0] ?? `shot-${message.id}`;
  try {
    if (!hasId) {
      const fromShot = await ingestScreenshotFromMessage(message, hint);
      if (fromShot) return;
      const match = await ingestLatestCupMatch();
      void notifySiteRefresh();
      await message.reply(formatMatchReply(match));
      if (message.guild) await syncPlayoffMatchesChannel(message.guild);
      return;
    }
    try {
      const match = await ingestMatch({ raw: raw || text });
      void notifySiteRefresh();
      await message.reply(formatMatchReply(match));
      if (message.guild) await syncPlayoffMatchesChannel(message.guild);
      return;
    } catch (error) {
      const fromShot = await ingestScreenshotFromMessage(message, hint);
      if (fromShot) return;
      throw error;
    }
  } catch (error) {
    await message.reply(fail(error));
  }
}

async function handleResultsScreenshot(message: Message) {
  if (!isResultsChannel(message)) return;
  if (/^!result\b/i.test(message.content) || /opendota\.com\/matches\/\d+/i.test(message.content)) {
    return;
  }
  if (!resultsImageAttachment(message)) return;
  try {
    await ingestScreenshotFromMessage(message, `shot-${message.id}`);
  } catch (error) {
    await message.reply(fail(error));
  }
}

client.on("interactionCreate", async (interaction: Interaction) => {
  if (interaction.isAutocomplete()) {
    try {
      if (interaction.commandName === "captain") {
        await handleTeamNameAutocomplete(interaction);
      } else {
        await handleScheduleAutocomplete(interaction);
      }
    } catch (error) {
      console.warn(
        "schedule autocomplete",
        error instanceof Error ? error.message : error,
      );
      if (!interaction.responded) {
        await interaction.respond([]).catch(() => undefined);
      }
    }
    return;
  }
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
      await trySetMemberRegisteredRole(interaction.guild, discordId, true);
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
  if (
    interaction.isButton() &&
    (interaction.customId.startsWith("bid:") ||
      interaction.customId.startsWith("lot:"))
  ) {
    try {
      const sandbox = sandboxFromChannel(interaction.channel);
      const member = interaction.member as GuildMember | null;
      const parts = interaction.customId.split(":");
      const kind = parts[0];
      const spec = parts[1];
      const lotId = parts[2] ?? null;

      if (kind === "lot") {
        if (!isOrganizerInteraction(interaction)) {
          await interaction.reply({
            content:
              spec === "confirm"
                ? `Only **${adminRoleName()}** can press **Admin Confirm**. Captains bid only.`
                : `Only **${adminRoleName()}** can Skip.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const view =
          spec === "confirm"
            ? await confirmLot({ sandbox, lotId })
            : await skipLot({ sandbox, lotId });
        await interaction.editReply(
          spec === "confirm"
            ? `Confirmed **${view.lastSale?.playerName ?? "sale"}** → ${view.lastSale?.teamName ?? "?"} for **${view.lastSale?.price ?? 0}**.`
            : `Skipped **${view.lastSale?.playerName ?? "player"}**.`,
        );
        if (interaction.channel?.type === ChannelType.GuildText) {
          await publishLot(interaction.channel, view);
        }
        if (!sandbox && spec === "confirm") {
          await trySyncCupChannelAccess(interaction.guild);
        }
        return;
      }

      if (
        sandbox &&
        !isOrganizer(member, interaction.user.id)
      ) {
        await interaction.reply({
          content: `Only **${adminRoleName()}** can bid in **#${dummyAuctionChannelName()}**.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const view =
        spec === "open"
          ? await placeBid({ discordId: interaction.user.id, sandbox, lotId })
          : await placeBid({
              discordId: interaction.user.id,
              bump: Number(spec),
              sandbox,
              lotId,
            });
      await interaction.editReply(
        `${sandbox ? "TEST bid " : "Bid "}**${view.currentBid}** — ${view.highBidder?.name ?? "?"}`,
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
  await handleResultsScreenshot(message);
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

async function refreshPostedLot(sandbox = false) {
  const view = await getAuctionView(sandbox);
  if (!view.channelId || !view.messageId) return;
  const channel = await client.channels.fetch(view.channelId);
  if (channel?.type === ChannelType.GuildText) {
    await publishLot(channel, view);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`Bot online as ${client.user?.tag}`);
  void (async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        await backfillResultsChannel(guild);
      } catch (error) {
        console.warn(
          `Could not catch up #${resultsChannelName()} (${guild.name}):`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  })();
  try {
    const seeded = await backfillSeason1();
    console.log(
      `Season ready: ${formatSeasonLabel(seeded.season)} (copied teams ${seeded.copied.teams}, players ${seeded.copied.players}, fixtures ${seeded.copied.fixtures})`,
    );
  } catch (error) {
    console.warn(
      "season backfill",
      error instanceof Error ? error.message : error,
    );
  }
  await hydrateAuctionClock().catch(() => undefined);
  try {
    const repair = await repairAuctionScores();
    if (repair.pursesFixed.length > 0 || repair.duplicateLotsRemoved > 0) {
      console.log(
        `Repaired auction scores: removed ${repair.duplicateLotsRemoved} duplicate lots; purses ${repair.pursesFixed.map((p) => `${p.name} ${p.from}→${p.to}`).join(", ") || "ok"}`,
      );
      void notifySiteRefresh();
    }
  } catch (error) {
    console.warn("auction score repair", error);
  }
  for (const guild of client.guilds.cache.values()) {
    try {
      await ensureUpdatesChannel(guild);
      const posted = await postPendingReleases(guild);
      const fresh = posted.filter((row) => !row.skipped).length;
      if (fresh > 0) {
        console.log(`Posted ${fresh} changelog ${fresh === 1 ? "entry" : "entries"} in #${updatesChannelName()} (${guild.name})`);
      }
    } catch (error) {
      console.warn(
        `Could not set up #${updatesChannelName()} (${guild.name}):`,
        error instanceof Error ? error.message : error,
      );
    }
    try {
      await syncCupChannelAccess(guild);
      await syncCaptainRolesFromDb(guild);
      console.log(
        `Locked #captains and registered-only channels in ${guild.name}`,
      );
    } catch (error) {
      console.error(`channel access (${guild.name})`, error);
    }
    try {
      await syncGuildIcon(guild);
      console.log(`Set MM Dota Cup server icon for ${guild.name}`);
    } catch (error) {
      console.warn(
        `Could not set server icon for ${guild.name} (need Manage Server):`,
        error instanceof Error ? error.message : error,
      );
    }
    try {
      await refreshPinnedPaymentAnnouncement(guild, client.user?.id);
    } catch (error) {
      console.warn(
        `Could not refresh #payments announcement (${guild.name}):`,
        error instanceof Error ? error.message : error,
      );
    }
    try {
      const booked = await bookedGroupStageFromDb();
      if (booked) {
        const post = await postGroupStageToMatches(guild, booked, {
          botUserId: client.user?.id,
        });
        if (post.posted) {
          console.log(`Posted group stage in #${post.channel.name} (${guild.name})`);
        }
      }
    } catch (error) {
      console.warn(
        `Could not post group stage in #${matchesChannelName()} (${guild.name}):`,
        error instanceof Error ? error.message : error,
      );
    }
    try {
      const view = await getPlayoffView();
      if (view.groupStageComplete) {
        await openPlayoffsFromGroups();
        const post = await postPlayoffToMatches(guild, {
          botUserId: client.user?.id,
        });
        if (post.posted) {
          console.log(`Posted playoffs in #${post.channel.name} (${guild.name})`);
        } else if (post.updated) {
          console.log(`Updated playoffs in #${post.channel.name} (${guild.name})`);
        }
      }
    } catch (error) {
      console.warn(
        `Could not sync playoffs in #${matchesChannelName()} (${guild.name}):`,
        error instanceof Error ? error.message : error,
      );
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
  let auctionTickBusy = false;
  setInterval(async () => {
    if (auctionTickBusy) return;
    auctionTickBusy = true;
    try {
      for (const sandbox of [false, true]) {
        const { changed } = await tickAuction(sandbox);
        if (changed) await refreshPostedLot(sandbox);
      }
    } catch (error) {
      console.error("auction tick", error);
    } finally {
      auctionTickBusy = false;
    }
  }, 1000);
  let reminderTickBusy = false;
  setInterval(async () => {
    if (reminderTickBusy) return;
    reminderTickBusy = true;
    try {
      await tickMatchReminders(client);
    } catch (error) {
      console.error("match reminders", error);
    } finally {
      reminderTickBusy = false;
    }
  }, 60_000);
  setInterval(() => {
    void keepPrismaAlive();
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
