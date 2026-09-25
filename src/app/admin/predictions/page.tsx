import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { getPredictionLeaderboard } from "@/lib/predictions";
import { pageMeta } from "@/lib/seo";
import { AdminPredictionsBoard } from "@/components/admin/predictions-board";

export const dynamic = "force-dynamic";
export const metadata = pageMeta(
  "Admin Predictions",
  "Who predicted and their points.",
);

export default async function AdminPredictionsPage() {
  await requireAdmin();
  const board = await getPredictionLeaderboard(null, { forAdmin: true });

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Predictions"
        subtitle="Who predicted and their points (always visible to organizers)."
        pills={[{ value: board.rows.length, label: "predictors" }]}
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
