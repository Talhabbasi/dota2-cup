import { EmbedBuilder } from "discord.js";
import { MAX_ROSTER, MIN_ROSTER, STARTING_PURSE } from "./constants";
import { cupSiteUrl } from "./channel-moderation";
import { FINAL_BEST_OF, REGULAR_BEST_OF } from "./schedule";

export const CHANNEL_GUIDE_NAMES = [
  "register",
  "general",
  "captains",
  "auction",
  "results",
  "matches",
  "schedule",
] as const;

export type ChannelGuideName = (typeof CHANNEL_GUIDE_NAMES)[number];

export const CUP_RULES = {
  title: "MM Dota Cup — Official Rules",
  sections: [
    {
      name: "Registration",
      body: [
        `Use \`/register\` **only in #register** — same Steam, rank, role, and weekend availability rules as the website.`,
        `**Bot offline?** Open **${cupSiteUrl()}/register**, sign in with Discord, and submit your Steam profile URL there.`,
        "Pick your **main role** from the dropdown (Safelane, Mid, Offlane, supports, Sub, or **Flex / any role**).",
        "Pick your **weekend availability**: 8pm–12am, after 12am, or either. Change later with `/when` or the website Register page.",
        "**#register is commands only** — no hello/chat/game talk. The bot deletes off-topic messages; use **#general** for conversation.",
        "You must queue on the **same Steam account** you registered.",
        "One Discord account ↔ one Steam account. You cannot link a second Steam to the same Discord — ask an admin for `/player delete` to reset.",
        "Duplicates (same Steam on another Discord) are rejected.",
      ],
    },
    {
      name: "Discord channels",
      body: [
        "**#general** — chat, questions, announcements, match reminders.",
        "**#register** — `/register`, `/when`, `/me` only (or use the website if the bot is down).",
        "**#payments** — registered players only. Payment screenshots (1000 PKR per person). An Admin clicks ✅ to confirm.",
        "**#captains** — captain/admin commands only (`/roster`, `/purse`, `/schedule`, etc.).",
        "**#auction** — registered players only. Auction commands and bids (`/bid`, buttons). Captains bid; others watch.",
        "**#matches** — registered players only. Group-stage fixtures.",
        "Each franchise also has a **private team chat** — only that roster (and Admin) can see it. `/player add` / `/captain add` grant the team role; `/player remove` / `/captain remove` take it off.",
        "**#results** — registered players only. Post `!result <match id>` after games.",
        "**#schedule** — `/schedule list`, or the website Schedule page. Admin: `/schedule groups`, `/schedule add`, `/schedule edit`.",
        "Casual messages in command channels are **auto-deleted**. Keep banter in **#general**.",
      ],
    },
    {
      name: "Eligibility",
      body: [
        "This is an **indoor tournament** for the MM Discord.",
        "Only players who have **played with MM** (regularly or from time to time) may take part.",
        "**Outdoor / outside members are not allowed.** A separate outdoor tournament will follow later.",
      ],
    },
    {
      name: "Payments",
      body: [
        "Public registration is **closed**.",
        "Entry fee is **1000 PKR per person**. Substitutes do not pay.",
        "Pay on **SadaPay** — account **0301-3396885**, IBAN **PK16SADA0000003013396885**, title **Talha Abbasi**.",
        "Each team must collect **exactly 5000 PKR** (five starters — min and max).",
        "Post a clear transfer screenshot in **#payments**. An **Admin** clicks ✅ to confirm. You are not paid until then.",
        "Do not chat in **#payments** — screenshots only. Questions go in **#general**.",
      ],
    },
    {
      name: "Medal & role lock",
      body: [
        "Your medal and role are set at registration.",
        "After you join a team (captain or auction), **players cannot change medal or role**.",
        "Weekend play window can always be changed with `/when` or the website Register page.",
        "Admins can fix a wrong rank, role, or window with `/player edit user:@player rank:<medal> role:<role> when:<evening|late|both>` (or `discord_id`).",
        "Your **medal / rank** decides which **auction pool** you appear in (Immortal, Divine, etc.). Role does not split the pool.",
        "Teams draft any mix of players within budget — two safelanes, two mids, etc. is fine.",
        "Roster is **5 starters + 2 subs** (captain counts as one starter). Subs are auto-tagged after the fifth pick.",
        "Register honestly — sandbagging may get you removed by admins.",
      ],
    },
    {
      name: "Captains & rosters",
      body: [
        "Only **admins** assign captains (`/captain add user:@player team:<name>`). Players cannot self-claim a franchise.",
        "Admins add players with `/player add user:@player team:<name>`.",
        "Admins fix rank or role with `/player edit` (mention or Discord ID).",
        "Admins remove players (`/player remove`) or delete registrations (`/player delete`).",
        `Each team needs **${MIN_ROSTER}–${MAX_ROSTER}** players after the auction.`,
        `Captains receive **${STARTING_PURSE.toLocaleString()}** auction points in Discord only.`,
      ],
    },
    {
      name: "Auction (Discord #auction)",
      body: [
        "Admin starts one **rank** pool at a time (Immortal, Divine, Ancient, …).",
        "Captains bid with `/bid` or the buttons — buy any players you can afford.",
        "No position limits: two mids, two safelanes, etc. is allowed within your budget.",
        "First **5** players on a team are starters; picks **6 and 7** are marked **Sub**.",
        "Everyone at the same medal is in the same queue. Role is shown on the card only.",
      ],
    },
    {
      name: "Schedule & weekends",
      body: [
        "8 teams in **2 groups of 4**. Admin: `/playoff groups` then `/schedule groups` (Group A Saturday, Group B Sunday).",
        "Group stage: **single round-robin** — each team plays **3** best-of-1 matches (6 games per group, 12 total).",
        "Fixtures are posted in **#matches** (registered players only) and on the website Schedule page.",
        "When both groups are done, **4th place in each group is eliminated**. **3rd place does not play each other.** Group A 3rd waits for the loser of **A1 vs B2**. Group B 3rd waits for the loser of **B1 vs A2**.",
        "Upper Round 1 is **A1 vs B2** and **B1 vs A2** (Bo1). Those losers drop into Lower Round 1 against the waiting 3rd-place teams. The two Lower Round 1 winners play, then the Upper Final loser.",
        "Upper Final and Lower Final are Bo1. The **Grand Final is Bo3**.",
        `Every series is **best of ${REGULAR_BEST_OF}** except the grand final (**best of ${FINAL_BEST_OF}**, first to 2).`,
        "Playoff matches are Saturday or Sunday only, **10:00 AM–3:00 AM PKT**. Group-stage nights stay **10:00 PM–6:00 AM PKT**.",
        "Admin: `/playoff open` after groups, `/playoff post` to refresh **#matches**, `/schedule edit` to move a kickoff.",
        "Post `!result` after each game — the bot books the next bracket match automatically when its prerequisites are complete.",
      ],
    },
    {
      name: "Match night",
      body: [
        "Name your Dota lobby with the **exact franchise names** from the schedule.",
        "Regular games are **best of 1**. The grand final is **best of 3** — post each game's match ID.",
        "Post `!result <match id>` in **#results** after each game (screenshot optional).",
        "Stats sync from OpenDota — the website updates standings automatically.",
      ],
    },
    {
      name: "Stand-ins & smurfs",
      body: [
        "Only registered Steam accounts count toward team mapping.",
        "If someone queues on an unregistered account, the match shows **unknown**.",
        "Admin must approve stand-ins: `/result assign steam32:<id> user:@player` **before** or after the game.",
        "Repeated stand-ins without admin approval = forfeit at organizer discretion.",
      ],
    },
    {
      name: "Conduct",
      body: [
        "No toxicity, cheating, or account sharing.",
        "Organizers (Admin role) have final say on disputes.",
        "Questions? Ask in **#general** or use `/help`.",
      ],
    },
  ],
};

function guideEmbed(title: string, description: string, lines: string[]) {
  return new EmbedBuilder()
    .setColor(0xb07d1f)
    .setTitle(title)
    .setDescription(description)
    .addFields({
      name: "What to do",
      value: lines.map((l) => `• ${l}`).join("\n"),
    })
    .setFooter({ text: "MM Dota Cup · /help for commands" });
}

export function buildRulesEmbed(): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xb07d1f)
    .setTitle(CUP_RULES.title)
    .setDescription(
      "Pinned rules for MM Dota Cup. Read before you register or queue.",
    );

  for (const section of CUP_RULES.sections) {
    embed.addFields({
      name: section.name,
      value: section.body.join("\n"),
    });
  }

  return embed.setFooter({ text: "Admins: /rules post · /rules channels" });
}

export function getChannelGuides(): { channelName: ChannelGuideName; embed: EmbedBuilder }[] {
  return [
    {
      channelName: "register",
      embed: guideEmbed(
        "#register — Player sign-up",
        "Every player starts here. One Steam account per person. **Commands only** — no casual chat.",
        [
          "Steam app → profile → **Share → Copy Page URL** (full link only, no raw ID numbers).",
          `Run \`/register\` in this channel with Steam URL, rank, role, and weekend availability.`,
          `**Bot offline or not responding?** Register on the website: **${cupSiteUrl()}/register** — sign in with Discord, same rules.`,
          "`/when` updates weekend availability · `/me` shows your saved profile.",
          "Off-topic messages (hello, game chat, memes) are **deleted** — talk in **#general**.",
          "One Discord + one Steam — you cannot change Steam without admin `/player delete`.",
          "After you join a team, **medal and role lock** for you — register honestly. Admin: `/player edit`.",
          "Queue on this exact Steam account in every cup game.",
        ],
      ),
    },
    {
      channelName: "general",
      embed: guideEmbed(
        "#general — Cup overview",
        "Announcements, questions, and match reminders land here.",
        [
          "Read the **full pinned rules** in this channel before your first match.",
          "Website shows standings, teams, and matches (no login needed).",
          "Captains get **match reminders** here ~1 hour before scheduled games.",
          "Keep sign-ups in **#register**, payment screenshots in **#payments**, bids in **#auction**, scores in **#results**.",
          "This is an **indoor** MM tournament — outdoor / outside members are not allowed.",
          "**#register**, **#captains**, and **#auction** are commands-only — the bot deletes casual chat.",
          "Questions? Ask here or run `/help` for every command.",
        ],
      ),
    },
    {
      channelName: "captains",
      embed: guideEmbed(
        "#captains — Franchise owners only",
        "Private channel for captains and admins. **Slash commands only** — no casual chat.",
        [
          "Admin: `/captain add user:@player team:Wolves`",
          `Captain receives **${STARTING_PURSE.toLocaleString()}** auction points.`,
          "Captain checks roster: `/roster` and `/purse`",
          "Schedule: `/schedule list` · fixtures also on the website.",
          `Roster must reach **${MIN_ROSTER}–${MAX_ROSTER}** players after the auction.`,
          "Lobby name in Dota must match your **franchise name** exactly.",
          "Questions and banter → **#general**. Off-topic messages here are deleted.",
        ],
      ),
    },
    {
      channelName: "auction",
      embed: guideEmbed(
        "#auction — Draft night",
        "Registered cup players can watch. Captains and admins bid with commands or buttons. **No casual chat.**",
        [
          "Admin: `/auction start rank:immortal` (then divine, ancient, …).",
          "Captains bid: `/bid amount:3200` or use the **+100 / +500** buttons.",
          "Buy any mix within budget — two safelanes, two mids, etc.",
          "Same **rank** shares one queue. Listed role is info only.",
          "Clock ends → Admin **Confirm** (sell) or **Skip**. Does not auto-charge.",
          "Players 6 and 7 on your roster auto-become **Sub**.",
          "Admin: `/auction pause` · `/auction resume` · `/auction skip` · `/auction confirm`",
          "Reactions and hello messages are removed — discuss in **#general**.",
        ],
      ),
    },
    {
      channelName: "results",
      embed: guideEmbed(
        "#results — Post match scores",
        "Registered cup players only. After every game, post the Dota Match ID here.",
        [
          "Dota → profile → Matches → open the game → copy **Match ID**.",
          "Post: `!result 8123456789` (optional scoreboard screenshot).",
          "Everyone must queue on their **registered Steam account**.",
          "Website updates heroes, KDA, items, and standings automatically.",
          "Unknown player? Admin: `/result assign steam32:<id> user:@player`",
          "Lobby name must match both franchise names from the schedule.",
        ],
      ),
    },
    {
      channelName: "matches",
      embed: guideEmbed(
        "#matches — Group-stage fixtures",
        "Registered players only. The round-robin grid lives here.",
        [
          "Group A plays Saturday, Group B plays Sunday. Every group match is **Bo1**.",
          "Each team plays **3** group games (6 per group, 12 total).",
          "After groups: 4th out. 3rd in each group waits for a crossover loser (A3 vs A1–B2 loser, B3 vs B1–A2 loser), then upper/lower playoffs. Grand Final **Bo3**.",
          "Kickoffs: group stage **10:00 PM–4:00 AM PKT**; playoffs **Saturday/Sunday 10:00 AM–3:00 AM PKT**.",
          "Same fixtures on the website **Schedule** and **Playoffs** pages.",
          "Admin: `/schedule groups` to book the grid, `/playoff open` after groups, `/schedule edit` to move a match.",
          "After you play, post `!result <match id>` in **#results**.",
        ],
      ),
    },
    {
      channelName: "schedule",
      embed: guideEmbed(
        "#schedule — Fixtures & match times",
        "8 teams, 2 groups, then a 6-team double-elimination playoff.",
        [
          "Everyone: `/playoff status` or `/schedule list`.",
          "Admin: `/schedule groups` books the 12-match group round-robin (posts in **#matches**).",
          "Admin: `/playoff open` after groups finish. `/playoff post` refreshes the bracket in **#matches**.",
          "Admin: `/schedule add` — Saturday or Sunday. Group stage 10pm–6am PKT; playoffs 10am–3am PKT.",
          "Change a booked match with `/schedule edit` (teams or time). Delete one with `/schedule remove`.",
          "The next bracket match is created automatically after `!result` once its prerequisites are complete.",
          "Captains get a reminder in **#general** ~1 hour before each game.",
        ],
      ),
    },
  ];
}

export function rulesChannelName(): string {
  return process.env.RULES_CHANNEL_NAME?.trim() || "general";
}

export function registerChannelName(): string {
  return process.env.REGISTER_CHANNEL_NAME?.trim() || "register";
}
