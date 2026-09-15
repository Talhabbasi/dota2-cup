import { CupScheduleBoard } from "@/components/cup-schedule";
import { GroupStandingsTable } from "@/components/group-standings";
import { getGroupStandings } from "@/lib/group-stage-schedule";
import { listCupSchedule } from "@/lib/schedule-crud";

export const revalidate = 30;

export default async function SchedulePage() {
  const [fixtures, groupA, groupB] = await Promise.all([
    listCupSchedule({ publicOnly: true }),
    getGroupStandings("A"),
    getGroupStandings("B"),
  ]);
  const upcoming = fixtures.filter((fixture) => fixture.status === "scheduled");

  return (
    <div className="page schedule-page">
      <header className="teams-list-hero">
        <div className="team-hero-glow" aria-hidden />
        <div className="teams-list-hero-body">
          <p className="eyebrow">Fixtures</p>
          <h1>Schedule</h1>
          <p className="lede">
            Group A Saturday, Group B Sunday, then weekend playoffs. Group
            kickoffs 10:00 PM–4:00 AM PKT. Playoffs Saturday/Sunday 10:00 AM–3:00
            AM PKT. Admins: <strong>/schedule groups</strong>,{" "}
            <strong>/schedule edit</strong>, <strong>/playoff open</strong>.
          </p>
          {fixtures.length > 0 ? (
            <div className="teams-list-hero-pills">
              <span className="teams-list-hero-pill">
                <strong>{upcoming.length}</strong> upcoming
              </span>
              <span className="teams-list-hero-pill">
                <strong>{fixtures.length - upcoming.length}</strong> played
              </span>
            </div>
          ) : null}
        </div>
      </header>
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
