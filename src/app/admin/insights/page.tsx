import { PageHeader } from "@/components/common";
import { AdminSeasonViewer } from "@/components/admin/season-viewer";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveAdminSeasonView } from "@/lib/admin-season-view";
import { getAdminInsights } from "@/lib/admin-insights";
import { getPublicPlayerInsight } from "@/lib/player-insight";
import { pageMeta } from "@/lib/seo";
import { AdminInsightsBoard } from "@/components/admin/insights-board";

export const dynamic = "force-dynamic";
export const metadata = pageMeta(
  "Admin Insights",
  "Cup stats — same awards as public Player Insight, plus full leaderboards.",
);

export default async function AdminInsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const { view, options, readOnly, publicSeasonParam } =
    await resolveAdminSeasonView(sp.season);
  const [data, highlights] = await Promise.all([
    getAdminInsights(view.id),
    getPublicPlayerInsight({ seasonId: view.id }),
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
      <AdminSeasonViewer
        view={view}
        options={options}
        readOnly={readOnly}
        publicSeasonParam={publicSeasonParam}
        publicHref="/player-insight"
      />
      <AdminInsightsBoard data={data} highlights={highlights} />
    </div>
  );
}
