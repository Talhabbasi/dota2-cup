import { EmbedBuilder } from "discord.js";
import { MAX_ROSTER, MIN_ROSTER, STARTING_PURSE } from "./constants";
import { FINAL_BEST_OF, MATCHES_PER_WEEKEND, REGULAR_BEST_OF } from "./schedule";

export const CHANNEL_GUIDE_NAMES = [
  "register",
  "general",
  "captains",
  "auction",
  "results",
  "schedule",
] as const;

export type ChannelGuideName = (typeof CHANNEL_GUIDE_NAMES)[number];

export const CUP_RULES = {
  title: "MM Dota Cup — Official Rules",
  sections: [
    {
      name: "Registration",
      body: [
        "Use `/register` **only in #register**, or register on the website while signed in with Discord.",
        "Pick your **main role** from the dropdown (Safelane, Mid, Offlane, supports, Sub, or **Flex / any role**).",
        "Pick your **weekend window**: 8pm–12am, after 12am, or either. Change later with `/when`.",
        "You must queue on the **same Steam account** you registered.",
        "One Discord account ↔ one Steam account. You cannot link a second Steam to the same Discord — ask an admin for `/player delete` to reset.",
        "Duplicates (same Steam on another Discord) are rejected.",
      ],
    },
    {
      name: "Medal & role lock",
      body: [
        "Your medal and role are set at registration.",
        "After you join a team (captain or auction), **players cannot change medal or role**.",
        "Weekend play window can always be changed with `/when` or the website Register page.",
        "Admins can fix a wrong rank, role, or window with `/player edit user:@player rank:<medal> role:<role> when:<evening|late|both>` (or `discord_id`).",
        "Your registered role decides which **auction pool** you appear in (mid, safelane, etc.).",
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
        "Admin starts one role pool at a time (mid, safelane, offlane, supports, sub).",
        "Captains bid with `/bid` or the buttons — buy any players you can afford.",
        "No position limits: two mids, two safelanes, etc. is allowed within your budget.",
        "First **5** players on a team are starters; picks **6 and 7** are marked **Sub**.",
        "Flex players appear in every pool until sold once.",
      ],
    },
    {
      name: "Schedule & weekends",
      body: [
        "Admin runs `/schedule generate` when every team has 5+ players.",
        `Each weekend has **${MATCHES_PER_WEEKEND}** matches (Friday, Saturday, Sunday).`,
        "Kickoff is **11:30 PM PKT** if both teams can play 8pm–12am, or **12:30 AM PKT** if they only overlap after midnight.",
        "A team plays at most **2** games per weekend.",
        `Every regular-season game is **best of ${REGULAR_BEST_OF}** — one lobby, one winner.`,
        `After the regular season, the **top 2** teams play a **best of ${FINAL_BEST_OF}** grand final (first to 2).`,
        "Every team pairing happens **once** in the regular season — no duplicate fixtures.",
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
        "Every player starts here. One Steam account per person.",
        [
          "Steam app → profile → **Share → Copy Page URL** (full link only, no raw ID numbers).",
          "`/register` works **only in this channel** — not in #general. If the bot is offline, use the website Register page.",
          "`/register steam:<url> rank:ancient role:safelane when:evening` — role + weekend window (8pm–12am, after 12am, or both).",
          "Change your window anytime with `/when`. `/me` shows what is saved.",
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
          "Keep sign-ups in **#register**, bids in **#auction**, scores in **#results**.",
          "Questions? Ask here or run `/help` for every command.",
        ],
      ),
    },
    {
      channelName: "captains",
      embed: guideEmbed(
        "#captains — Franchise owners only",
        "This channel is private. Only captains and admins can see it.",
        [
          "Admin: `/captain add user:@player team:Wolves`",
          `Captain receives **${STARTING_PURSE.toLocaleString()}** auction points.`,
          "Admin: `/player add` to place unsigned players on a team.",
          "Captain checks roster: `/roster` and `/purse`",
          `Roster must reach **${MIN_ROSTER}–${MAX_ROSTER}** players after the auction.`,
          "Lobby name in Dota must match your **franchise name** exactly.",
        ],
      ),
    },
    {
      channelName: "auction",
      embed: guideEmbed(
        "#auction — Draft night",
        "Everyone can watch. Only captains and admins can send messages.",
        [
          "Admin: `/auction start role:mid` (then safelane, offlane, supports, sub).",
          "Captains bid: `/bid amount:3200` or use the **+100 / +500** buttons.",
          "Buy any mix within budget — two safelanes, two mids, etc.",
          "Flex players appear in every pool until sold once.",
          "30-second clock resets after each bid.",
          "Players 6 and 7 on your roster auto-become **Sub**.",
          "Admin: `/auction pause` · `/auction skip` · `/auction undo`",
          "Auction runs here only — the website is read-only stats.",
        ],
      ),
    },
    {
      channelName: "results",
      embed: guideEmbed(
        "#results — Post match scores",
        "After every game, post the Dota Match ID here.",
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
      channelName: "schedule",
      embed: guideEmbed(
        "#schedule — Fixtures & match times",
        "When every team has 5+ players, admins generate the season schedule.",
        [
          "Everyone: `/schedule list` — upcoming Fri / Sat / Sun fixtures.",
          "Kickoff is **11:30 PM PKT** (evening window) or **12:30 AM PKT** (late window). Website shows UK, EU, US times.",
          `Regular season is **best of ${REGULAR_BEST_OF}**. Max **2 games per team** per weekend.`,
          `Grand final: **top 2** play **best of ${FINAL_BEST_OF}** (admin: \`/schedule final\`).`,
          "Every team pairing happens **once** in the regular season.",
          "Admin: `/schedule generate` when rosters are full · `/schedule clear` to reset.",
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
