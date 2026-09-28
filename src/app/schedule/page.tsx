import { PageHeader } from "@/components/common";
import { CupScheduleBoard } from "@/components/cup-schedule";
import { GroupStandingsTable } from "@/components/group-standings";
import { SeasonArchiveBannerServer } from "@/components/season-archive-banner-server";
import { loadGroupStandingsForSeason } from "@/lib/season-data";
import { getPublicSeasonContext } from "@/lib/season-page";
import { listCupSchedule } from "@/lib/schedule-crud";
import { pageMeta } from "@/lib/seo";
import { CUP_NAME } from "@/lib/brand";
import { seasonScheduleSubtitle } from "@/lib/season-public-copy";

export const revalidate = 30;

export const metadata = pageMeta(
  "Match Schedule",
  `Weekend ${CUP_NAME} fixtures in Pakistan time — group stage, playoffs, and upcoming Dota 2 kickoffs.`,
);

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sp = await searchParams;
  const { view, seasonId } = await getPublicSeasonContext(sp);
  const [fixtures, groupA, groupB] = await Promise.all([
    listCupSchedule({ publicOnly: true, seasonId: seasonId ?? undefined }),
    seasonId
      ? loadGroupStandingsForSeason(seasonId, "A")
      : Promise.resolve([]),
    seasonId
      ? loadGroupStandingsForSeason(seasonId, "B")
      : Promise.resolve([]),
  ]);
  const upcoming = fixtures.filter((fixture) => fixture.status === "scheduled");
  const groupSize = view?.teamCount ? Math.max(2, Math.floor(view.teamCount / 2)) : 4;
  const subtitle = view
    ? seasonScheduleSubtitle({
        number: view.number,
        name: view.name,
        teamCount: view.teamCount,
        tournamentFormat: view.tournamentFormat,
        plannedStartAt: view.plannedStartAt,
        startedAt: view.startedAt,
        phase: view.phase,
      })
    : "Group A Saturday, Group B Sunday, then weekend playoffs. Kickoffs follow fixtures booked in admin (PKT).";

  return (
    <div className="page schedule-page">
      <SeasonArchiveBannerServer season={sp.season} />
      <PageHeader
        eyebrow="Fixtures"
        title={view ? `Schedule · Season ${view.number}` : "Schedule"}
        subtitle={subtitle}
        pills={
          fixtures.length > 0
            ? [
                { value: upcoming.length, label: "upcoming" },
                {
                  value: fixtures.length - upcoming.length,
                  label: "played",
                },
                ...(view
                  ? [{ value: view.teamCount, label: "planned teams" }]
                  : []),
              ]
            : view
              ? [{ value: view.teamCount, label: "planned teams" }]
              : undefined
        }
      />
      <div className="group-standings-row-wrap">
        <GroupStandingsTable
          title="Group A"
          rows={groupA}
          markLastEliminated={
            groupA.length === groupSize &&
            groupA.every((row) => row.played === groupSize - 1)
          }
        />
        <GroupStandingsTable
          title="Group B"
          rows={groupB}
          markLastEliminated={
            groupB.length === groupSize &&
            groupB.every((row) => row.played === groupSize - 1)
          }
        />
      </div>
      <CupScheduleBoard fixtures={fixtures} />
    </div>
  );
}
