import Link from "next/link";
import { PageHeader } from "@/components/common";
import { GroupStandingsTable } from "@/components/group-standings";
import { PlayoffBracket } from "@/components/playoff-bracket";
import { PlayoffGraphLazy } from "@/components/playoff-graph-lazy";
import { SeasonArchiveBannerServer } from "@/components/season-archive-banner-server";
import type { GroupGraphMatch } from "@/components/playoff-graph";
import {
  loadGroupStandingsForSeason,
} from "@/lib/season-data";
import { getPlayoffView } from "@/lib/playoff";
import { getPublicSeasonContext } from "@/lib/season-page";
import { listCupSchedule } from "@/lib/schedule-crud";
import { getSeasonSnapshotBracket } from "@/lib/seasons";
import { pageMeta } from "@/lib/seo";
import { CUP_NAME } from "@/lib/brand";
import { seasonPlayoffsSubtitle } from "@/lib/season-public-copy";

export const revalidate = 30;

export const metadata = pageMeta(
  "Playoff Bracket",
  `Follow the ${CUP_NAME} playoff graph: group standings, upper and lower brackets, and the Grand Final.`,
);

export default async function PlayoffsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sp = await searchParams;
  const { view: viewSeason, seasonId } = await getPublicSeasonContext(sp);

  const [viewFromSnap, viewLive, groupA, groupB, fixtures] = await Promise.all([
    viewSeason?.isArchive && seasonId
      ? getSeasonSnapshotBracket(seasonId)
      : Promise.resolve(null),
    getPlayoffView(),
    seasonId
      ? loadGroupStandingsForSeason(seasonId, "A")
      : Promise.resolve([]),
    seasonId
      ? loadGroupStandingsForSeason(seasonId, "B")
      : Promise.resolve([]),
    listCupSchedule({
      publicOnly: true,
      seasonId: seasonId ?? undefined,
    }),
  ]);

  const view = viewFromSnap ?? viewLive;
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
  const subtitle = viewSeason
    ? (
        <>
          {seasonPlayoffsSubtitle({
            number: viewSeason.number,
            name: viewSeason.name,
            teamCount: viewSeason.teamCount,
            tournamentFormat: viewSeason.tournamentFormat,
            plannedStartAt: viewSeason.plannedStartAt,
            startedAt: viewSeason.startedAt,
            phase: viewSeason.phase,
          })}{" "}
          Follow the graph, then the match cards. See the{" "}
          <Link href="/schedule">schedule</Link>.
        </>
      )
    : (
        <>
          After the group stage: last place is eliminated, crossovers feed a
          double-elimination bracket. Grand Final is Bo3; every other series is
          Bo1. See the <Link href="/schedule">schedule</Link>.
        </>
      );

  return (
    <div className="page playoffs-page">
      <SeasonArchiveBannerServer season={sp.season} />
      <PageHeader
        eyebrow="Tournament"
        title={viewSeason ? `Playoffs · Season ${viewSeason.number}` : "Playoffs"}
        subtitle={subtitle}
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
