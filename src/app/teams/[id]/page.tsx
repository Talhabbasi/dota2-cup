import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MatchCard } from "@/components/match-card";
import {
  TeamProfileHero,
  TeamRosterBoard,
  type TeamPlayerView,
} from "@/components/team-profile";
import { getStandings, getTeam, getTeamName, formatRoles } from "@/lib/data";
import {
  PLAY_WINDOW_SHORT,
  deriveTeamPlayWindow,
  playWindowOrBoth,
} from "@/lib/play-window";
import { isRosterSub, parseRolesJson, sortTeamRoster } from "@/lib/roles";

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const name = await getTeamName(id);
  if (!name) return { title: "Team" };
  return {
    title: name,
    description: `${name} roster, captain, and MM Dota Cup results for this indoor Dota 2 season.`,
  };
}

function toPlayerView(player: {
  id: string;
  steamName: string;
  medal: string;
  rolesJson: string;
  playWindow: string;
  isCaptain: boolean;
  rosterRole: string | null;
}): TeamPlayerView {
  return {
    id: player.id,
    steamName: player.steamName,
    medal: player.medal,
    rolesLabel: formatRoles(parseRolesJson(player.rolesJson)),
    playWindowLabel: PLAY_WINDOW_SHORT[playWindowOrBoth(player.playWindow)],
    isCaptain: player.isCaptain,
    isSub: isRosterSub(player.rosterRole),
  };
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [team, standings] = await Promise.all([getTeam(id), getStandings()]);
  if (!team) notFound();

  const captain = team.players.find((p) => p.isCaptain);
  const ordered = sortTeamRoster(team.players);
  const starters = ordered.filter((player) => !isRosterSub(player.rosterRole));
  const subs = ordered.filter((player) => isRosterSub(player.rosterRole));
  const record = standings.find((row) => row.id === team.id);
  const teamWindow = deriveTeamPlayWindow(
    team.players.map((p) => playWindowOrBoth(p.playWindow)),
  );

  const history = [...team.radiantMatches, ...team.direMatches]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 8);

  return (
    <div className="page team-detail-page">
      <Link href="/teams" className="back-link">
        ← Teams
      </Link>

      <TeamProfileHero
        teamName={team.name}
        captainName={captain?.steamName ?? null}
        playerCount={team.players.length}
        starterCount={starters.length}
        subCount={subs.length}
        wins={record?.wins ?? 0}
        losses={record?.losses ?? 0}
        playWindowLabel={PLAY_WINDOW_SHORT[teamWindow]}
      />

      <TeamRosterBoard
        starters={starters.map(toPlayerView)}
        subs={subs.map(toPlayerView)}
      />

      <section className="team-matches-panel">
        <div className="section-head">
          <h2>Matches</h2>
        </div>
        {history.length === 0 ? (
          <div className="team-empty-matches">
            <span className="team-empty-matches-icon" aria-hidden>
              ⚔
            </span>
            <p className="muted" style={{ margin: 0 }}>
              No matches yet.
            </p>
          </div>
        ) : (
          <div className="vs-stack">
            {history.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
