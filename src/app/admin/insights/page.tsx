import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminInsights } from "@/lib/admin-insights";
import { getPublicPlayerInsight } from "@/lib/player-insight";
import { pageMeta } from "@/lib/seo";
import { AdminInsightsBoard } from "@/components/admin/insights-board";

export const dynamic = "force-dynamic";
export const metadata = pageMeta(
  "Admin Insights",
  "Cup stats — same awards as public Player Insight, plus full leaderboards.",
);

export default async function AdminInsightsPage() {
  await requireAdmin();
  const [data, highlights] = await Promise.all([
    getAdminInsights(),
    getPublicPlayerInsight(),
  ]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Insights"
        subtitle="Same highlight winners as Player Insight — plus full tables, roles, and auction detail."
        pills={[
          { value: data.matchesPlayed, label: "matches" },
          { value: data.registeredPlayers, label: "players" },
        ]}
      />
      <AdminInsightsBoard data={data} highlights={highlights} />
    </div>
  );
}
