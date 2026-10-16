import { PageHeader } from "@/components/common";
import { AdminPlayoffsDesk } from "@/components/admin/playoffs-desk";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveAdminSeasonView } from "@/lib/admin-season-view";
import { formatScheduleWhen } from "@/lib/schedule";
import { upcomingWeekendDates } from "@/lib/schedule-crud";
import { getPlayoffViewFresh } from "@/lib/playoff";
import { pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = pageMeta(
  "Admin Playoffs",
  "Groups, group schedule, and upper bracket — synced with Discord.",
);

export default async function AdminPlayoffsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { view: seasonView, readOnly } = await resolveAdminSeasonView(
    sp.season,
  );
  const playoff = await getPlayoffViewFresh();
  const weekendDates = upcomingWeekendDates(10);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Playoffs"
        subtitle={
          readOnly
            ? `Archive Season ${seasonView.number} — groups and bracket are read-only.`
            : "Random groups, book the round-robin, open the upper bracket. Mirrors Discord /playoff and /schedule groups."
        }
        pills={[
          { value: playoff.groupA.length, label: "Group A" },
          { value: playoff.groupB.length, label: "Group B" },
          {
            value: playoff.groupStageComplete ? "Ready" : "Groups",
            label: playoff.groupStageComplete ? "for bracket" : "in progress",
          },
        ]}
      />
      <AdminPlayoffsDesk
        readOnly={readOnly}
        weekendDates={weekendDates}
        view={{
          groupA: playoff.groupA,
          groupB: playoff.groupB,
          unassigned: playoff.unassigned,
          teamCount: playoff.teamCount,
          groupSize: playoff.groupSize,
          groupRoundRobin: playoff.groupRoundRobin,
          groupStageComplete: playoff.groupStageComplete,
          eliminatePlace: playoff.eliminatePlace,
          hasLowerPlayIn: playoff.hasLowerPlayIn,
          standingsA: playoff.standingsA.map((r) => ({
            name: r.name,
            points: r.points,
            played: r.played,
          })),
          standingsB: playoff.standingsB.map((r) => ({
            name: r.name,
            points: r.points,
            played: r.played,
          })),
          matchSummary: playoff.matches.map((m) => ({
            label: m.label,
            status: m.displayStatus,
            when: m.scheduledAt ? formatScheduleWhen(m.scheduledAt) : null,
          })),
        }}
      />
    </div>
  );
}
