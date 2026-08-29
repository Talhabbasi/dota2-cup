import { StandingsBoard } from "@/components/standings-board";
import { getStandings } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function TablePage() {
  const rows = await getStandings();

  const views = rows.map((row) => ({
    id: row.id,
    name: row.name,
    played: row.played,
    wins: row.wins,
    losses: row.losses,
    points: row.points,
  }));

  const totalGames = views.reduce((n, r) => n + r.played, 0);

  return (
    <div className="page standings-page">
      <header className="teams-list-hero standings-hero">
        <div className="team-hero-glow" aria-hidden />
        <div className="teams-list-hero-body">
          <p className="eyebrow">League</p>
          <h1>Standings</h1>
          <p className="lede">
            Three points for a win. Ranked after posted results from Discord.
          </p>
          {views.length > 0 ? (
            <div className="teams-list-hero-pills">
              <span className="teams-list-hero-pill">
                <strong>{views.length}</strong> teams
              </span>
              <span className="teams-list-hero-pill">
                <strong>{totalGames}</strong> games played
              </span>
            </div>
          ) : null}
        </div>
      </header>

      {views.length === 0 ? (
        <div className="empty-panel teams-list-empty">
          <span className="team-empty-matches-icon" aria-hidden>
            🏆
          </span>
          <p className="muted" style={{ margin: 0 }}>
            No teams on the table yet.
          </p>
        </div>
      ) : (
        <StandingsBoard rows={views} />
      )}
    </div>
  );
}
