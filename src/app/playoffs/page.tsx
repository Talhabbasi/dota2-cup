import Link from "next/link";
import { PageHeader } from "@/components/common";
import { GroupStandingsTable } from "@/components/group-standings";
import { PlayoffBracket } from "@/components/playoff-bracket";
import { PlayoffGraphLazy } from "@/components/playoff-graph-lazy";
import type { GroupGraphMatch } from "@/components/playoff-graph";
import { getGroupStandings } from "@/lib/group-stage-schedule";
import { getPlayoffView } from "@/lib/playoff";
import { listCupSchedule } from "@/lib/schedule-crud";
import { pageMeta } from "@/lib/seo";
import { CUP_NAME } from "@/lib/brand";

export const revalidate = 30;

export const metadata = pageMeta(
  "Playoff Bracket",
  `Follow the ${CUP_NAME} playoff graph: group standings, upper and lower brackets, and the Grand Final.`,
);

export default async function PlayoffsPage() {
  const [view, groupA, groupB, fixtures] = await Promise.all([
    getPlayoffView(),
    getGroupStandings("A"),
    getGroupStandings("B"),
    listCupSchedule({ publicOnly: true }),
  ]);
  const groupIdsA = new Set(groupA.map((row) => row.id));
  const groupMatches: GroupGraphMatch[] = fixtures
    .filter((fixture) => fixture.kind === "group")
    .map((fixture) => ({
      id: fixture.id,
      group: groupIdsA.has(fixture.radiantTeamId) ? "A" : "B",
      radiant: fixture.radiantTeam,
      dire: fixture.direTeam,
      scheduledAt: fixture.scheduledAt,
      status: fixture.status,
      winnerName: fixture.match?.winnerTeam?.name ?? null,
    }));

  const noGroups = view.groupA.length === 0 && view.groupB.length === 0;

  return (
    <div className="page playoffs-page">
      <PageHeader
        eyebrow="Tournament"
        title="Playoffs"
        subtitle={
          <>
            After the group stage: 4th is eliminated. 3rd in each group waits
            for a crossover loser — A3 vs the loser of A1 vs B2, B3 vs the loser
            of B1 vs A2 — then a 6-team double-elimination bracket. Grand Final
            is Bo3; every other series is Bo1. Follow the graph, then the match
            cards. See the <Link href="/schedule">schedule</Link>.
          </>
        }
        pills={
          noGroups
            ? undefined
            : [
                {
                  label: (
                    <>
                      <strong>Group A</strong> {view.groupA.length} teams
                    </>
                  ),
                },
                {
                  label: (
                    <>
                      <strong>Group B</strong> {view.groupB.length} teams
                    </>
                  ),
                },
              ]
        }
      />

      {noGroups ? (
        <div className="empty-panel teams-list-empty">
          <p className="muted" style={{ margin: 0 }}>
            Playoffs open after groups are set and the group stage finishes.
            Follow the <Link href="/schedule">schedule</Link> until then.
          </p>
        </div>
      ) : (
        <>
          <div className="group-standings-row-wrap">
            <GroupStandingsTable
              title="Group A"
              rows={groupA}
              markLastEliminated={view.groupStageComplete}
            />
            <GroupStandingsTable
              title="Group B"
              rows={groupB}
              markLastEliminated={view.groupStageComplete}
            />
          </div>

          <PlayoffGraphLazy view={view} groupMatches={groupMatches} />
          <PlayoffBracket view={view} />
        </>
      )}
    </div>
  );
}
