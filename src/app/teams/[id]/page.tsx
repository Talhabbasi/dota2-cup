import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchCard } from "@/components/match-card";
import {
  TeamProfileHero,
  TeamRosterBoard,
  type TeamPlayerView,
} from "@/components/team-profile";
import { getStandings, getTeam, formatRoles } from "@/lib/data";
import { isRosterSub, parseRolesJson } from "@/lib/roles";

export const dynamic = "force-dynamic";

function toPlayerView(player: {
  id: string;
  steamName: string;
  medal: string;
  rolesJson: string;
  isCaptain: boolean;
  rosterRole: string | null;
}): TeamPlayerView {
  return {
    id: player.id,
    steamName: player.steamName,
    medal: player.medal,
    rolesLabel: formatRoles(parseRolesJson(player.rolesJson)),
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
  const starters = team.players.filter((p) => !isRosterSub(p.rosterRole));
  const subs = team.players.filter((p) => isRosterSub(p.rosterRole));
  const record = standings.find((row) => row.id === team.id);

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
              No matches posted for this team yet.
            </p>
            <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
              Results sync when match IDs are posted in Discord #results.
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
