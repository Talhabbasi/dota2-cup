export const HELP_COMMANDS = `**Anyone**
\`/register\` — public sign-up in #register (admins can close this)
\`/when window:<evening|late|both>\` — weekend play window (8pm–12am, after 12am, or either)
\`/me\` — your registration, team, role, weekend window, and **payment status**
\`/pay unpaid\` — starters who still owe, grouped by team (subs are free)
\`/pay teams\` — which teams have collected exactly **5000 PKR** (min and max)
\`/pay team name:<team>\` — who on that team has not paid
\`/help\` — this list
\`/schedule list\` — upcoming fixtures

**Captain**
\`/bid amount:<number>\` or the +100 / +500 buttons
\`/purse\` — points left
\`/roster\` — your 5–7 and empty slots

**Admin** (Discord role **Admin**)
\`/admin setup\` — create **#payments** (everyone can see it) and post this help in **#admin**
\`/admin help\` — post this command list into **#admin** again
\`/registration close\` — close website + Discord sign-ups (posts 3 announcements + creates #payments)
\`/registration open\` — re-open public registration
\`/registration status\`
\`/rules post\` — post & pin full cup rules in #general
\`/rules channels\` — pin a short guide in every cup channel (+ full rules in #general)
\`/rules closed\` — create **#payments** and post closed / indoor / payment messages
\`/captain add user:@x team:<name>\`
\`/captain remove user:@x\`
\`/player list\` — every registered player (team, role, paid/unpaid)
\`/player register user:@x steam:<url> rank: role: when:\` — late add
\`/player add user:@x team:<name>\` — add unsigned player to a team
\`/player remove user:@x\` — take player off a team (keeps registration)
\`/player delete user:@x\` — remove player from the cup (also off their team)
\`/player edit user:@x rank:<medal> role:<role> when:<evening|late|both>\` — fix rank, role, and/or weekend window (or \`discord_id:<id>\`)
\`/player resync user:@x\` — fix roster slot from registration
\`/pay mark user:@x\` — mark paid without waiting for a screenshot tick
\`/schedule generate\` — round-robin Fri/Sat/Sun after all teams have 5+ players
\`/schedule final\` — BO3 grand final for the top 2
\`/schedule clear\`
\`/auction start role:<mid|safelane|offlane|soft_support|hard_support|sub>\`
\`/auction pause\` · \`/auction skip\` · \`/auction undo\`
\`/result match_id:<id>\` or in #results: \`!result 8123456789\`
\`/result assign steam32:<id> user:@player\` — map a stand-in / smurf`;

export const HELP_GUIDE = `## How to run the cup

**Registration.** Admins toggle with \`/registration close\` or \`/registration open\`. Late add: \`/player register\`. Remove: \`/player delete\`. Website Register tab is hidden while closed. This is an **indoor MM** tournament — outdoor members are not allowed.

**Payments.** Entry fee is **1000 PKR per person**. Substitutes **do not pay**. A team is allowed only at **exactly 5000 PKR** (five starters). Post a transfer screenshot in **#payments**. An **Admin clicks ✅** to confirm. Backup: \`/pay mark\`. Check \`/pay unpaid\` and \`/pay teams\`.

**Channels.** **#register**, **#captains**, and **#auction** are **commands only**. **#payments** is **screenshots only**. Use **#general** for conversation.

**Captains.** Only admins assign captains with \`/captain add user:@player team:<name>\`. Players cannot self-claim. Captains get **20,000** auction points in Discord.

**Rosters.** Admins can manually add unsigned players with \`/player add\`. Role slots always follow what the player picked at registration. Players 6–7 on a roster are **subs** and skip the fee.

**Auction night.** Admin runs one pool at a time in #auction. Captains buy any players within budget — no position limits. Roster is 5 starters + 2 subs (captain counts as a starter).

**Schedule.** When every team has 5+ players, admin runs \`/schedule generate\`. Matches spread across **Fri / Sat / Sun**. Kickoff is **11:30 PM PKT** when both teams can play 8pm–12am, or **12:30 AM PKT** when they only overlap after midnight. Regular games are **best of 1**. Max **2 games per team** per weekend. After the table is set, the **top 2** play a **best of 3** grand final (\`/schedule final\`).

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
