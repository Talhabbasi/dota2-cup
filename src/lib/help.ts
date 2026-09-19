export const HELP_PIN_PREFIX = "**MM Dota Cup — pinned command sheet**";

export const HELP_COMMANDS = `${HELP_PIN_PREFIX}
Pinned in **#admin** for every Admin. Re-post anytime with \`/admin help\`.

**Anyone**
\`/register\` — public sign-up in #register (admins can close this)
\`/when window:<evening|late|both>\` — weekend play window (8pm–12am, after 12am, or either)
\`/me\` — your medal, role, and team card (\`user:@x\` optional)
\`/pool\` — all players except captains, grouped by role with medal
\`/unsigned\` — registered players not on a team yet (auction pool)
\`/pay collected\` — money in, still owed, expected
\`/pay unpaid\` — starters who still owe (subs are free)
\`/pay teams\` — which teams have collected exactly **5000 PKR**
\`/pay team name:<team>\` — who on that team has not paid
\`/help\` — this list
\`/schedule list\` — upcoming fixtures
\`/playoff status\` — groups, bracket graph, times, Bo1/Bo3

**Captain**
\`/bid amount:<number>\` or the +100 / +500 buttons
\`/purse\` — points left
\`/roster\` — your 5–7 and empty slots

**Admin — setup**
\`/admin setup\` — #payments, team chats, team voice, and this sheet in **#admin**
\`/admin help\` — post & pin this sheet in **#admin** again
\`/season current\` — which season the bot is writing to (right now Season 1)
\`/season list\` — every season
\`/season create name:<optional>\` — add the next season (does **not** switch live data)
\`/season start number:<n>\` — archive the live season and make season n live
\`/updates add kind:added|fixed|removed text:\` — post a note to **#updates** (Admin only)
\`/updates post\` — post pending changelog entries to **#updates**
\`/registration close\` — close website + Discord sign-ups
\`/registration open\` — re-open public registration
\`/registration status\`
\`/rules post\` — post & pin full cup rules in #general
\`/rules channels\` — pin a short guide in every cup channel
\`/rules closed\` — #payments + closed / indoor / payment messages
\`/rules clear\` — remove bot-posted channel guides

**Admin — players & captains**
\`/captain add user:@x team:<name>\` — create a new franchise
\`/captain change team:<name> user:@x\` — swap captain; roster + schedule stay
\`/captain rename team:<old> name:<new>\` — name only; fixtures stay on the same team
\`/captain remove user:@x\` — **dissolves the team** (not a captain swap)
\`/player list\` — every registered player (team, role, paid/unpaid)
\`/player unsigned\` — players not on a team, grouped by rank
\`/player register user:@x steam:<url> rank: role: when:\` — late add
\`/player add user:@x team:<name>\` — add unsigned player to a team
\`/player remove user:@x\` — take them off the team (or \`discord_id:<id>\` if they left)
\`/player delete user:@x\` — remove from the cup (or \`discord_id:<id>\` if they left Discord)
\`/player edit user:@x rank: role: when:\` — or \`discord_id:<id>\`
\`/player resync user:@x\` — fix roster slot from registration

**Admin — payments**
Screenshot in **#payments**, then an Admin clicks **✅**.
\`/pay mark user:@x\` — mark paid without a screenshot
\`/pay collected\` · \`/pay unpaid\` · \`/pay teams\` · \`/pay team name:<team>\`
Subs do **not** pay. Each team must be exactly **5000 PKR** (5 starters).

**Admin — schedule & playoffs**
\`/schedule groups\` — book Group A Saturday + Group B Sunday (posts in **#matches**)
\`/schedule add team_a: team_b: date:YYYY-MM-DD time:\` — Sat/Sun (group 10pm–6am · playoffs 10am–3am PKT)
\`/schedule edit fixture:\` — change teams or kickoff
\`/schedule remove fixture:\` — delete one booked match
\`/schedule list\` · \`/schedule clear\` — clear deletes **pending** fixtures (careful)
\`/schedule final\` — book a Bo3 grand final (legacy helper)
\`/playoff groups\` — randomly split 8 teams into A/B (groups are already set)
\`/playoff assign team:<name> group:<A|B>\`
\`/playoff open\` — book playoffs from **final group standings** (does not touch group matches)
\`/playoff post\` — post/refresh the bracket graph in **#matches**
\`/playoff status\` — same data as the website Playoffs page
\`/playoff clear\` — pending playoff fixtures only (keeps the group-stage grid)
Website: **Schedule** + **Playoffs** (tournament graph) + **Predictions**. Group-stage picks (10 pts) lock Saturday **10:45 PM PKT**. **The International** tab (upper / lower / Grand Final 50 pts) stays locked until every group match is done. One combined points board. After groups: 4th out, A3 vs B3 Advancement Bo1, then double-elim. Grand Final **Bo3**.

**Admin — results**
\`/result match_id:<id>\` or in #results: \`!result 8123456789\`
\`/result winner fixture: team:\` — record who won when you only have a lobby ID (no OpenDota)
\`/result assign steam32:<id> user:@player\` — map a stand-in / smurf
The last group \`!result\` opens the first playoff matches automatically.

**Admin — auction**
\`/auction start rank:<immortal|divine|ancient|legend|archon|crusader|guardian|herald|uncalibrated>\`
\`/auction pause\` · \`/auction resume\` · \`/auction skip\` · \`/auction confirm\`
\`/auction revert user:@x\` or \`name:<steam>\` — return a sold player, refund purse
\`/auction undo\` — undo the last sale
**#auction-test** is Admin only and never writes live cup data. Bid with buttons or \`/bid\`.`;

export const HELP_GUIDE = `## How to run the cup

**Registration.** Admins toggle with \`/registration close\` or \`/registration open\`. Late add: \`/player register\`. Remove: \`/player delete\`. Website Register tab is hidden while closed. This is an **indoor MM** tournament — outdoor members are not allowed.

**Payments.** Entry fee is **1000 PKR per person** via **SadaPay** (\`0301-3396885\`, IBAN \`PK16SADA0000003013396885\`, Talha Abbasi). Substitutes **do not pay**. A team is allowed only at **exactly 5000 PKR** (five starters). Post a transfer screenshot in **#payments**. An **Admin clicks ✅** to confirm. Backup: \`/pay mark\`. Check \`/pay collected\` for the running total, plus \`/pay unpaid\` and \`/pay teams\`.

**Channels.** **#register**, **#captains**, and **#auction** are **commands only**. **#payments**, **#teams**, **#matches**, **#results**, and **#auction** are visible to **registered players only**. Each franchise also gets a **private team chat** (only that roster) and a **5-player voice** room (captain + Admin can drag). **#auction-test** is **Admin only** and never writes live cup data. **#payments** is screenshots only. Use **#general** for conversation.

**Captains.** Only admins assign captains with \`/captain add\`. To replace a captain without deleting the franchise, use \`/captain change\` — the old captain stays on the roster, and scheduled matches do not change. \`/captain rename\` changes the display name only (same team id, same fixtures). \`/captain remove\` **dissolves the whole team**. Players cannot self-claim. Captains get **20,000** auction points in Discord.

**Rosters.** Admins can manually add unsigned players with \`/player add\` — they get that team's Discord role, private chat, and the same registered-player permissions as everyone else. \`/player remove\` takes the team role and chat away. Role slots always follow what the player picked at registration. Players 6–7 on a roster are **subs** and skip the fee.

**Auction night.** Admin runs one **rank** pool at a time in #auction (Immortal, then Divine, and so on). Same medal = same pool, regardless of role. Captains buy any players within budget — no position limits. Roster is 5 starters + 2 subs (captain counts as a starter). Practice in **#auction-test** (Admin only) — that channel never writes purses, rosters, or the website.

**Playoffs.** 8 teams, 2 groups of 4. Admin: \`/playoff groups\` then \`/schedule groups\` (Group A Saturday, Group B Sunday, 10:00 PM–4:00 AM PKT). When both groups finish, 4th is eliminated and \`/playoff open\` (or the last \`!result\`) books A3 vs B3 plus Upper Round 1. Playoff kickoffs are Saturday/Sunday **10:00 AM–3:00 AM PKT**. Grand Final is **Bo3**; every other series is **Bo1**. Change any booked match with \`/schedule edit\`. Kickoff times also show on the website **Schedule** / **Playoffs** pages and in **#matches**.

**Reminders.** The bot pings captains in #general about **1 hour** before a scheduled match (configurable).

**After a match.** Play on registered Steam accounts. Post \`!result <match id>\` in #results. Lobby names should match franchise names.

**Stand-ins.** Admin: \`/result assign\` for unregistered Steam IDs. See pinned rules in #general.`;

export function splitDiscordChunks(text: string, max = 1900): string[] {
  if (text.length <= max) return [text];
  const lines = text.split("\n");
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length <= max) {
      current = next;
      continue;
    }
    if (current) chunks.push(current);
    if (line.length <= max) {
      current = line;
      continue;
    }
    for (let i = 0; i < line.length; i += max) {
      chunks.push(line.slice(i, i + max));
    }
    current = "";
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text.slice(0, max)];
}

export function fullHelpText() {
  return `${HELP_COMMANDS}\n\n${HELP_GUIDE}`;
}
