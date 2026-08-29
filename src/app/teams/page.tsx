import Link from "next/link";
import { TeamsGrid, type TeamCardView } from "@/components/teams-grid";
import { getStandings, getTeams } from "@/lib/data";
import { isRosterSub } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const [teams, table] = await Promise.all([getTeams(), getStandings()]);
  const rankById = new Map(table.map((row, i) => [row.id, i + 1]));
  const recordById = new Map(table.map((row) => [row.id, row]));

  const cards: TeamCardView[] = teams.map((team) => {
    const captain = team.players.find((p) => p.isCaptain);
    const starters = team.players.filter((p) => !isRosterSub(p.rosterRole));
    const subs = team.players.filter((p) => isRosterSub(p.rosterRole));
    const record = recordById.get(team.id);

    return {
      id: team.id,
      name: team.name,
      captainName: captain?.steamName ?? null,
      playerCount: team.players.length,
      starterCount: starters.length,
      subCount: subs.length,
      wins: record?.wins ?? 0,
      losses: record?.losses ?? 0,
      rank: rankById.get(team.id) ?? 0,
    };
  });

  return (
    <div className="page teams-list-page">
      <header className="teams-list-hero">
        <div className="team-hero-glow" aria-hidden />
        <div className="teams-list-hero-body">
          <p className="eyebrow">Franchises</p>
          <h1>Teams</h1>
          <p className="lede">
            Rosters and results. Registration and drafting happen in Discord.
          </p>
          {cards.length > 0 ? (
            <div className="teams-list-hero-pills">
              <span className="teams-list-hero-pill">
                <strong>{cards.length}</strong> active franchises
              </span>
              <span className="teams-list-hero-pill">
                <strong>
                  {cards.reduce((n, t) => n + t.playerCount, 0)}
                </strong>{" "}
                players signed
              </span>
            </div>
          ) : null}
        </div>
      </header>

      {cards.length === 0 ? (
        <div className="empty-panel teams-list-empty">
          <span className="team-empty-matches-icon" aria-hidden>
            🏆
          </span>
          <p className="eyebrow">Empty lobby</p>
          <p className="muted" style={{ margin: 0 }}>
            No franchises yet. An admin assigns captains in Discord.
          </p>
        </div>
      ) : (
        <TeamsGrid teams={cards} />
      )}
    </div>
  );
}
