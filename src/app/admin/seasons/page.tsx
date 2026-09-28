import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { getCupSettings } from "@/lib/cup-settings-cache";
import { listSeasonsForAdmin } from "@/lib/seasons";
import { pageMeta } from "@/lib/seo";
import { AdminSeasonsBoard } from "@/components/admin/seasons-board";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("Admin Seasons", "Create, activate, and archive cup seasons.");

export default async function AdminSeasonsPage() {
  await requireAdmin();
  const [seasons, settings] = await Promise.all([
    listSeasonsForAdmin(),
    getCupSettings(),
  ]);

  const rows = seasons.map((row) => ({
    id: row.id,
    number: row.number,
    name: row.name,
    status: row.status,
    phase: row.phase,
    plannedStartAt: row.plannedStartAt,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    tournamentFormat: row.tournamentFormat,
    teamCount: row.teamCount,
    championName: row.championTeam?.name ?? null,
    isLivePointer: settings?.currentSeasonId === row.id,
  }));

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Seasons"
        subtitle="Create upcoming seasons, go live, or end & archive. Ending clears the active homepage until the next season is activated."
      />
      <AdminSeasonsBoard seasons={rows} liveSeasonId={settings?.currentSeasonId ?? null} />
    </div>
  );
}
