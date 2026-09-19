import { MatchesGrid, type MatchListView } from "@/components/matches-grid";
import { getMatches } from "@/lib/data";
import { matchKillTotals } from "@/lib/match-score";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta(
  "Match Results",
  "MM Dota Cup match results, scores, and Dota 2 series history for the live indoor season.",
);

export default async function MatchesPage() {
  const matches = await getMatches();

  const views: MatchListView[] = matches.map((m) => {
    const { radiantKills, direKills } = matchKillTotals(m.players, {
      radiantScore: m.radiantScore,
      direScore: m.direScore,
    });
    return {
      id: m.id,
      openDotaId: m.openDotaId,
      duration: m.duration,
      radiantWin: m.radiantWin,
      radiantScore: m.radiantScore,
      direScore: m.direScore,
      radiantTeam: m.radiantTeam,
      direTeam: m.direTeam,
      winnerTeam: m.winnerTeam,
      players: m.players.map((p) => ({ side: p.side, kills: p.kills })),
      createdAt: m.createdAt,
      killDiff: Math.abs(radiantKills - direKills),
    };
  });

  const totalKills = views.reduce((sum, m) => {
    const t = matchKillTotals(m.players, {
      radiantScore: m.radiantScore,
      direScore: m.direScore,
    });
    return sum + t.radiantKills + t.direKills;
  }, 0);

  return (
    <div className="page matches-list-page">
      <header className="teams-list-hero matches-list-hero">
        <div className="team-hero-glow" aria-hidden />
        <div className="teams-list-hero-body">
          <p className="eyebrow">Scoreboard</p>
          <h1>Matches</h1>
          {views.length > 0 ? (
            <div className="teams-list-hero-pills">
              <span className="teams-list-hero-pill">
                <strong>{views.length}</strong> games logged
              </span>
              {totalKills > 0 ? (
                <span className="teams-list-hero-pill">
                  <strong>{totalKills}</strong> total kills tracked
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {views.length === 0 ? (
        <div className="empty-panel teams-list-empty">
          <span className="team-empty-matches-icon" aria-hidden>
            ⚔
          </span>
          <p className="muted" style={{ margin: 0 }}>
            No matches yet.
          </p>
        </div>
      ) : (
        <MatchesGrid matches={views} />
      )}
    </div>
  );
}
