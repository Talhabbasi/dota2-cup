import {
  ChannelType,
  EmbedBuilder,
  type Guild,
} from "discord.js";
import { cupSiteUrl } from "./channel-moderation";
import { ensureMatchesChannel } from "./cup-announcements";
import { lockRegisteredPlayerChannels } from "./payments-channel-access";
import {
  formatPlayoffGraph,
  formatPlayoffStatus,
  getPlayoffView,
  type PlayoffMatchView,
  type PlayoffView,
} from "./playoff";
import { formatScheduleWhen } from "./schedule";

const GOLD = 0xb07d1f;

export const PLAYOFF_POST_TITLE = "Playoffs — double elimination";

function formatLine(match: PlayoffMatchView) {
  const left = match.radiant?.name ?? match.leftLabel;
  const right = match.dire?.name ?? match.rightLabel;
  const when = match.scheduledAt ? formatScheduleWhen(match.scheduledAt) : null;
  const bits = [match.formatLabel];
  if (match.displayStatus === "completed" && match.winner) {
    bits.push(`Completed · ${match.winner.name} won`);
    if (match.loser && match.loserGoes === "Eliminated") {
      bits.push(`${match.loser.name} eliminated`);
    }
  } else if (match.displayStatus === "live") {
    bits.push(when ? `Live · ${when}` : "Live");
  } else if (match.displayStatus === "upcoming" && when) {
    bits.push(`Upcoming · ${when}`);
  } else {
    bits.push(match.waitingReason ?? "Waiting");
  }
  return `**${match.label}**\n${left} vs ${right}\n${bits.join(" · ")}`;
}

function rankBlock(title: string, rows: PlayoffView["standingsA"], complete: boolean) {
  if (rows.length === 0) return `${title}\nNot assigned.`;
  return [
    title,
    ...rows.map((row, index) => {
      const out = complete && index === 3 ? " — Eliminated" : "";
      return `${index + 1}. ${row.name}${out}`;
    }),
  ].join("\n");
}

export function playoffEmbeds(view: PlayoffView) {
  const site = cupSiteUrl();
  const matches = (stage: PlayoffMatchView["stage"]) =>
    view.matches.filter((match) => match.stage === stage).map(formatLine).join("\n\n");

  const overview = [
    "Same bracket as the website. 4th in each group is eliminated.",
    "Group A 3rd vs Group B 3rd is a **Bo1** Advancement Match.",
    "Upper Round 1: A1 vs B2, B1 vs A2. Every match is **Bo1** except the Grand Final (**Bo3**).",
    `Full bracket: **${site}/playoffs**`,
  ];

  if (view.eliminated.length > 0) {
    overview.push("", `Eliminated after groups: **${view.eliminated.map((team) => team.name).join(", ")}**`);
  }

  return [
    new EmbedBuilder()
      .setColor(GOLD)
      .setTitle(PLAYOFF_POST_TITLE)
      .setDescription(overview.join("\n")),
    new EmbedBuilder()
      .setColor(GOLD)
      .setTitle("Bracket graph")
      .setDescription(formatPlayoffGraph(view)),
    new EmbedBuilder()
      .setColor(GOLD)
      .setTitle("Final group standings")
      .setDescription(
        [
          rankBlock("**Group A**", view.standingsA, view.groupStageComplete),
          "",
          rankBlock("**Group B**", view.standingsB, view.groupStageComplete),
        ].join("\n"),
      ),
    new EmbedBuilder()
      .setColor(GOLD)
      .setTitle("Advancement Match · Bo1")
      .setDescription(matches("advancement") || "Waiting for both groups to finish."),
    new EmbedBuilder()
      .setColor(GOLD)
      .setTitle("Upper Bracket")
      .setDescription(matches("upper") || "Waiting."),
    new EmbedBuilder()
      .setColor(GOLD)
      .setTitle("Lower Bracket")
      .setDescription(matches("lower") || "Waiting."),
    new EmbedBuilder()
      .setColor(GOLD)
      .setTitle("Grand Final · Bo3")
      .setDescription(matches("grand") || "Waiting for both finalists."),
  ];
}

export async function postPlayoffToMatches(
  guild: Guild,
  options?: { botUserId?: string; force?: boolean },
) {
  const view = await getPlayoffView();
  if (!view.groupStageComplete && view.matches.every((match) => match.status === "empty")) {
    return { posted: false as const, updated: false as const, channel: null };
  }

  const channel = await ensureMatchesChannel(guild);
  await lockRegisteredPlayerChannels(guild);
  const embeds = playoffEmbeds(view);

  if (channel.type === ChannelType.GuildText && options?.botUserId) {
    const { items } = await channel.messages.fetchPins();
    for (const pin of items) {
      const msg = pin.message;
      if (
        msg.author.id === options.botUserId &&
        msg.embeds[0]?.title === PLAYOFF_POST_TITLE
      ) {
        await msg.edit({ embeds });
        return { posted: false as const, updated: true as const, channel };
      }
    }
  }

  const sent = await channel.send({ embeds });
  try {
    await sent.pin();
  } catch (error) {
    console.warn(
      `Could not pin playoffs in #${channel.name}:`,
      error instanceof Error ? error.message : error,
    );
  }
  return { posted: true as const, updated: false as const, channel };
}

export function playoffStatusText(view: PlayoffView) {
  return formatPlayoffStatus(view);
}
