export const HELP_COMMANDS = `**Anyone**
\`/register steam:<profile URL> rank:<medal> role:<dropdown> when:<evening|late|both>\` — **only in #register**. If the bot is offline, use the website **Register** page.
\`/when window:<evening|late|both>\` — weekend play window (8pm–12am, after 12am, or either)
\`/me\` — your registration, team, role, and weekend window
\`/help\` — this list
\`/schedule list\` — upcoming fixtures

**Captain**
\`/bid amount:<number>\` or the +100 / +500 buttons
\`/purse\` — points left
\`/roster\` — your 5–7 and empty slots

**Admin** (Discord role **Admin**)
\`/rules post\` — post & pin full cup rules in #general
\`/rules channels\` — pin a short guide in every cup channel (+ full rules in #general)
\`/captain add user:@x team:<name>\`
\`/captain remove user:@x\`
\`/player add user:@x team:<name>\` — add unsigned player to a team
\`/player remove user:@x\` — remove player from team
\`/player delete user:@x\` — delete registration (unsigned only)
\`/player edit user:@x rank:<medal> role:<role> when:<evening|late|both>\` — fix rank, role, and/or weekend window (or \`discord_id:<id>\`)
\`/player resync user:@x\` — fix roster slot from registration
\`/schedule generate\` — round-robin Fri/Sat/Sun after all teams have 5+ players
\`/schedule final\` — BO3 grand final for the top 2
\`/schedule clear\`
\`/auction start role:<mid|safelane|offlane|soft_support|hard_support|sub>\`
\`/auction pause\` · \`/auction skip\` · \`/auction undo\`
\`/result match_id:<id>\` or in #results: \`!result 8123456789\`
\`/result assign steam32:<id> user:@player\` — map a stand-in / smurf`;

export const HELP_GUIDE = `## How to run the cup

**Register.** Steam app → profile → **Share → Copy Page URL** (must be a full link). In Discord run \`/register\` in **#register** with that URL, your medal, **one role**, and **when** you can play on weekends. **If the bot is offline**, register at the website **Register** page (sign in with Discord) — same rules. Change availability later with \`/when\`. One Discord account + one Steam account — you cannot swap Steam later without an admin reset.

**Channels.** **#register**, **#captains**, and **#auction** are **commands only** — hello, game chat, and memes are auto-deleted. Use **#general** for conversation.

**Captains.** Only admins assign captains with \`/captain add user:@player team:<name>\`. Players cannot self-claim. Captains get **20,000** auction points in Discord.

**Rosters.** Admins can manually add unsigned players with \`/player add\`. Role slots always follow what the player picked at registration.

**Auction night.** Admin runs one pool at a time in #auction. Captains buy any players within budget — no position limits. Roster is 5 starters + 2 subs (captain counts as a starter).

**Schedule.** When every team has 5+ players, admin runs \`/schedule generate\`. Matches spread across **Fri / Sat / Sun**. Kickoff is **11:30 PM PKT** when both teams can play 8pm–12am, or **12:30 AM PKT** when they only overlap after midnight. Regular games are **best of 1**. Max **2 games per team** per weekend. After the table is set, the **top 2** play a **best of 3** grand final (\`/schedule final\`).

**Reminders.** The bot pings captains in #general about **1 hour** before a scheduled match (configurable).

**After a match.** Play on registered Steam accounts. Post \`!result <match id>\` in #results. Lobby names should match franchise names.

**Stand-ins.** Admin: \`/result assign\` for unregistered Steam IDs. See pinned rules in #general.`;
