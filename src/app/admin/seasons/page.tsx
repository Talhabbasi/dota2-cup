import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { getCupSettings } from "@/lib/cup-settings-cache";
import { listSeasonsForAdmin } from "@/lib/seasons";
import { pageMeta } from "@/lib/seo";
import { AdminSeasonsBoard } from "@/components/admin/seasons-board";

export const dynamic = "force-dynamic";
export const metadata = pageMeta(
  "Admin Seasons",
  "Create, edit, activate, archive, and delete cup seasons.",
);

function toDateInput(value: Date | null) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // Calendar day in PKT — avoid UTC off-by-one from toISOString().
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return null;
  return `${y}-${m}-${day}`;
}

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
    plannedStartAt: toDateInput(row.plannedStartAt),
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    tournamentFormat: row.tournamentFormat,
    teamCount: row.teamCount,
    championName: row.championTeam?.name ?? null,
    isActive: Boolean(row.isActive),
    isLivePointer: settings?.currentSeasonId === row.id || Boolean(row.isActive),
    hasData:
      row._count.teams > 0 ||
      row._count.matches > 0 ||
      row._count.fixtures > 0 ||
      row._count.players > 0,
  }));

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Seasons"
        subtitle="Create, edit, set active, end & archive, delete. Planned start + team count sync to the site hero, banner, Teams, and Players pages."
      />
      <AdminSeasonsBoard
        seasons={rows}
        liveSeasonId={
          seasons.find((s) => s.isActive)?.id ?? settings?.currentSeasonId ?? null
        }
      />
    </div>
  );
}
