import { PageHeader } from "@/components/common";
import { CupScheduleBoard } from "@/components/cup-schedule";
import { GroupStandingsTable } from "@/components/group-standings";
import { getGroupStandings } from "@/lib/group-stage-schedule";
import { listCupSchedule } from "@/lib/schedule-crud";
import { pageMeta } from "@/lib/seo";
import { CUP_NAME } from "@/lib/brand";

export const revalidate = 30;

export const metadata = pageMeta(
  "Match Schedule",
  `Weekend ${CUP_NAME} fixtures in Pakistan time — group stage, playoffs, and upcoming Dota 2 kickoffs.`,
);

export default async function SchedulePage() {
  const [fixtures, groupA, groupB] = await Promise.all([
    listCupSchedule({ publicOnly: true }),
    getGroupStandings("A"),
    getGroupStandings("B"),
  ]);
  const upcoming = fixtures.filter((fixture) => fixture.status === "scheduled");

  return (
    <div className="page schedule-page">
      <PageHeader
        eyebrow="Fixtures"
        title="Schedule"
        subtitle={
          <>
            Group A Saturday, Group B Sunday, then weekend playoffs. Group
            kickoffs 10:00 PM–4:00 AM PKT. Playoffs Saturday/Sunday 10:00 AM–3:00
            AM PKT.
          </>
        }
        pills={
          fixtures.length > 0
            ? [
                { value: upcoming.length, label: "upcoming" },
                {
                  value: fixtures.length - upcoming.length,
                  label: "played",
                },
              ]
            : undefined
        }
      />
      <div className="group-standings-row-wrap">
        <GroupStandingsTable
          title="Group A"
          rows={groupA}
          markLastEliminated={groupA.length === 4 && groupA.every((row) => row.played === 3)}
        />
        <GroupStandingsTable
          title="Group B"
          rows={groupB}
          markLastEliminated={groupB.length === 4 && groupB.every((row) => row.played === 3)}
        />
      </div>
      <CupScheduleBoard fixtures={fixtures} />
    </div>
  );
}
