import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { adminListTeamsForPicker } from "@/lib/match-admin";
import { listCupSchedule } from "@/lib/schedule-crud";
import { formatScheduleWhen } from "@/lib/schedule";
import { pageMeta } from "@/lib/seo";
import { AdminScheduleBoard } from "@/components/admin/schedule-board";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("Admin Schedule", "Add and edit fixtures.");

export default async function AdminSchedulePage() {
  await requireAdmin();
  const [teams, fixtures] = await Promise.all([
    adminListTeamsForPicker(),
    listCupSchedule({ publicOnly: false }),
  ]);
  const pending = fixtures.filter((f) => f.status === "scheduled");

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Schedule"
        subtitle="Fixture table — click a row to reschedule, swap teams, or delete."
        pills={[{ value: pending.length, label: "pending" }]}
      />
      <AdminScheduleBoard
        fixtures={pending.map((f) => ({
          id: f.id,
          when: formatScheduleWhen(f.scheduledAt),
          teamA: f.radiantTeam.name,
          teamB: f.direTeam.name,
          kind: f.kind,
          status: f.status,
        }))}
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
      />
    </div>
  );
}
