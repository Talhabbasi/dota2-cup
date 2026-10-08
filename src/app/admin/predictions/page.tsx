import { PageHeader } from "@/components/common";
import { AdminSeasonViewer } from "@/components/admin/season-viewer";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveAdminSeasonView } from "@/lib/admin-season-view";
import { getPredictionLeaderboard } from "@/lib/predictions";
import { pageMeta } from "@/lib/seo";
import { AdminPredictionsBoard } from "@/components/admin/predictions-board";

export const dynamic = "force-dynamic";
export const metadata = pageMeta(
  "Admin Predictions",
  "Who predicted and their points.",
);

export default async function AdminPredictionsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { view, options, readOnly, publicSeasonParam } =
    await resolveAdminSeasonView(sp.season);
  const board = await getPredictionLeaderboard(null, {
    forAdmin: true,
    seasonId: view.id,
  });

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Predictions"
        subtitle="Who predicted and their points (always visible to organizers)."
        pills={[{ value: board.rows.length, label: "predictors" }]}
      />
      <AdminSeasonViewer
        view={view}
        options={options}
        readOnly={readOnly}
        publicSeasonParam={publicSeasonParam}
        publicHref="/predictions"
      />
      <AdminPredictionsBoard
        rows={board.rows.map((row) => ({
          rank: row.rank,
          name: row.name,
          points: row.points,
          correct: row.correct,
          picks: row.picks,
        }))}
      />
    </div>
  );
}
