import { PageHeader } from "@/components/common";
import { GroupStandingsTable } from "@/components/group-standings";
import { StandingsBoard } from "@/components/standings-board";
import { getGroupStandings } from "@/lib/group-stage-schedule";
import { getStandings } from "@/lib/data";
import { pageMeta } from "@/lib/seo";

export const revalidate = 30;

export const metadata = pageMeta(
  "League Standings",
  "Live MM Dota Cup standings: wins, losses, and points for every franchise this season.",
);

export default async function TablePage() {
  const [groupA, groupB, overall] = await Promise.all([
    getGroupStandings("A"),
    getGroupStandings("B"),
    getStandings(),
  ]);

  const views = overall.map((row) => ({
    id: row.id,
    name: row.name,
    played: row.played,
    wins: row.wins,
    losses: row.losses,
    points: row.points,
  }));

  const groupGames =
    groupA.reduce((n, r) => n + r.played, 0) +
    groupB.reduce((n, r) => n + r.played, 0);
  const hasGroups = groupA.length > 0 || groupB.length > 0;
  const markA =
    groupA.length === 4 && groupA.every((row) => row.played === 3);
  const markB =
    groupB.length === 4 && groupB.every((row) => row.played === 3);

  return (
    <div className="page standings-page">
      <PageHeader
        className="standings-hero"
        eyebrow="League"
        title="Standings"
        pills={
          hasGroups || views.length > 0
            ? [
                {
                  value: groupA.length + groupB.length || views.length,
                  label: "teams",
                },
                {
                  value: groupGames || views.reduce((n, r) => n + r.played, 0),
                  label: "games played",
                },
              ]
            : undefined
        }
      />

      {!hasGroups && views.length === 0 ? (
        <div className="empty-panel teams-list-empty">
          <span className="team-empty-matches-icon" aria-hidden>
            🏆
          </span>
          <p className="muted" style={{ margin: 0 }}>
            No teams on the table yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-8">
          {hasGroups ? (
            <div className="group-standings-row-wrap">
              <GroupStandingsTable
                title="Group A"
                rows={groupA}
                markLastEliminated={markA}
              />
              <GroupStandingsTable
                title="Group B"
                rows={groupB}
                markLastEliminated={markB}
              />
            </div>
          ) : null}

          {views.length > 0 ? (
            <section className="grid gap-3">
              <h2 className="m-0 font-display text-xl tracking-wide text-foreground">
                Overall
              </h2>
              <StandingsBoard rows={views} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
