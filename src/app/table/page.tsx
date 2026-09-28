import { PageHeader } from "@/components/common";
import { GroupStandingsTable } from "@/components/group-standings";
import { StandingsBoard } from "@/components/standings-board";
import { SeasonArchiveBannerServer } from "@/components/season-archive-banner-server";
import {
  loadGroupStandingsForSeason,
  loadStandingsForSeason,
} from "@/lib/season-data";
import { getGroupStandings } from "@/lib/group-stage-schedule";
import { getStandings } from "@/lib/data";
import { getPublicSeasonContext } from "@/lib/season-page";
import { pageMeta } from "@/lib/seo";
import { CUP_NAME } from "@/lib/brand";

export const revalidate = 30;

export const metadata = pageMeta(
  "League Standings",
  `Live ${CUP_NAME} standings: wins, losses, and points for every franchise this season.`,
);

export default async function TablePage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sp = await searchParams;
  const { view, seasonId } = await getPublicSeasonContext(sp);
  const [groupA, groupB, overall] = await Promise.all([
    seasonId
      ? loadGroupStandingsForSeason(seasonId, "A")
      : getGroupStandings("A"),
    seasonId
      ? loadGroupStandingsForSeason(seasonId, "B")
      : getGroupStandings("B"),
    seasonId ? loadStandingsForSeason(seasonId) : getStandings(),
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
    <div className="page table-page">
      <SeasonArchiveBannerServer season={sp.season} />
      <PageHeader
        eyebrow="Standings"
        title={view ? `Table · Season ${view.number}` : "Standings"}
        subtitle={
          hasGroups
            ? `${groupGames} group games counted toward placement. Overall table includes playoffs.`
            : "Team records update after each result is logged."
        }
        pills={
          views.length > 0
            ? [{ value: views.length, label: "teams" }]
            : undefined
        }
      />

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

      <StandingsBoard rows={views} />
    </div>
  );
}
