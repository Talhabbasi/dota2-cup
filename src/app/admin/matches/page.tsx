import { PageHeader } from "@/components/common";
import { requireAdmin } from "@/lib/admin-auth";
import { adminListRecentMatches } from "@/lib/match-admin";
import { formatScheduleWhen } from "@/lib/schedule";
import { pageMeta } from "@/lib/seo";
import { AdminMatchesBoard } from "@/components/admin/matches-board";

export const dynamic = "force-dynamic";
export const metadata = pageMeta("Admin Matches", "Fix match OCR and results.");

export default async function AdminMatchesPage() {
  await requireAdmin();
  const rawMatches = await adminListRecentMatches(40);

  const matches = rawMatches.map((match) => {
    const needsTeam =
      !match.radiantTeam?.id ||
      !match.direTeam?.id ||
      !match.winnerTeam?.id;
    const unmatchedCount = match.players.filter(
      (s) => !s.asStandIn && (s.unknown || !s.playerId),
    ).length;
    const standInCount = match.players.filter((s) => s.asStandIn).length;
    return {
      id: match.id,
      when: formatScheduleWhen(match.createdAt),
      radiantName: match.radiantTeam?.name ?? "Radiant?",
      direName: match.direTeam?.name ?? "Dire?",
      winnerName: match.winnerTeam?.name ?? null,
      needsTeam,
      unmatchedCount,
      standInCount,
    };
  });

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Matches"
        subtitle="Click a match to open its full editor."
        pills={[
          { value: matches.length, label: "recent" },
          {
            value: matches.filter((m) => m.unmatchedCount > 0).length,
            label: "need OCR fix",
          },
        ]}
      />
      <AdminMatchesBoard matches={matches} />
    </div>
  );
}
