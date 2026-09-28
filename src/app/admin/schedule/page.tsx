import { PageHeader } from "@/components/common";
import { AdminSeasonViewer } from "@/components/admin/season-viewer";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveAdminSeasonView } from "@/lib/admin-season-view";
import { adminListTeamsForPicker } from "@/lib/match-admin";
import { listCupSchedule } from "@/lib/schedule-crud";
import { formatScheduleWhen } from "@/lib/schedule";
import { pageMeta } from "@/lib/seo";
import { AdminScheduleBoard } from "@/components/admin/schedule-board";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("Admin Schedule", "Add and edit fixtures.");

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { view, options, readOnly, publicSeasonParam } =
    await resolveAdminSeasonView(sp.season);

  const [teams, fixtures] = await Promise.all([
    adminListTeamsForPicker(view.id),
    listCupSchedule({ publicOnly: false, seasonId: view.id }),
  ]);
  const shown = readOnly
    ? fixtures
    : fixtures.filter((f) => f.status === "scheduled");
  const pending = fixtures.filter((f) => f.status === "scheduled");

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Schedule"
        subtitle={
          readOnly
            ? `Archive Season ${view.number} fixtures — read-only.`
            : "Open a fixture → upload scoreboard (winner from OCR) or mark win / walkover. Rematches always create a new match."
        }
        pills={[
          {
            value: readOnly ? shown.length : pending.length,
            label: readOnly ? "fixtures" : "pending",
          },
        ]}
      />
      <AdminSeasonViewer
        view={view}
        options={options}
        readOnly={readOnly}
        publicSeasonParam={publicSeasonParam}
        publicHref="/schedule"
      />
      <AdminScheduleBoard
        fixtures={shown.map((f) => ({
          id: f.id,
          when: formatScheduleWhen(f.scheduledAt),
          teamA: f.radiantTeam.name,
          teamB: f.direTeam.name,
          kind: f.kind,
          status: f.status,
        }))}
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        readOnly={readOnly}
        publicSeasonParam={publicSeasonParam}
      />
    </div>
  );
}
