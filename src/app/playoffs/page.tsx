import Link from "next/link";
import { GroupStandingsTable } from "@/components/group-standings";
import { PlayoffBracket } from "@/components/playoff-bracket";
import { PlayoffGraph, type GroupGraphMatch } from "@/components/playoff-graph";
import { getGroupStandings } from "@/lib/group-stage-schedule";
import { getPlayoffView } from "@/lib/playoff";
import { listCupSchedule } from "@/lib/schedule-crud";

export const revalidate = 30;

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

  return (
    <div className="page playoffs-page">
      <header className="teams-list-hero">
        <div className="team-hero-glow" aria-hidden />
        <div className="teams-list-hero-body">
          <p className="eyebrow">Tournament</p>
          <h1>Playoffs</h1>
          <p className="lede">
            After the group stage: 4th is eliminated, 3rd plays a Bo1 Advancement
            Match, then a 5-team double-elimination bracket. Grand Final is Bo3;
            every other series is Bo1. Follow the graph, then the match cards.
            See the <Link href="/schedule">schedule</Link>.
          </p>
          <div className="teams-list-hero-pills">
            <span className="teams-list-hero-pill">
              <strong>Group A</strong> {view.groupA.length} teams
            </span>
            <span className="teams-list-hero-pill">
              <strong>Group B</strong> {view.groupB.length} teams
            </span>
          </div>
        </div>
      </header>

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

      <PlayoffGraph view={view} groupMatches={groupMatches} />
      <PlayoffBracket view={view} />
    </div>
  );
}
