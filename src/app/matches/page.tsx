import { PageHeader } from "@/components/common";
import { MatchesGrid, type MatchListView } from "@/components/matches-grid";
import { SeasonArchiveBannerServer } from "@/components/season-archive-banner-server";
import { getMatches } from "@/lib/data";
import { loadMatchesForSeason } from "@/lib/season-data";
import { matchKillTotals } from "@/lib/match-score";
import { getPublicSeasonContext } from "@/lib/season-page";
import { pageMeta } from "@/lib/seo";
import { CUP_NAME } from "@/lib/brand";

export const revalidate = 30;

export const metadata = pageMeta(
  "Match Results",
  `${CUP_NAME} match results, scores, and Dota 2 series history for the live indoor season.`,
);

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sp = await searchParams;
  const { view, seasonId } = await getPublicSeasonContext(sp);
  const matches = seasonId
    ? await loadMatchesForSeason(seasonId)
    : await getMatches();

  const views: MatchListView[] = matches.map((m) => {
    const { radiantKills, direKills } = matchKillTotals(m.players, {
      radiantScore: m.radiantScore,
      direScore: m.direScore,
    });
    return {
      id: m.id,
      openDotaId: m.openDotaId,
      duration: m.duration,
      radiantWin: m.radiantWin,
      radiantScore: m.radiantScore,
      direScore: m.direScore,
      radiantTeam: m.radiantTeam,
      direTeam: m.direTeam,
      winnerTeam: m.winnerTeam,
      players: m.players.map((p) => ({ side: p.side, kills: p.kills })),
      createdAt: m.createdAt,
      killDiff: Math.abs(radiantKills - direKills),
    };
  });

  const totalKills = views.reduce((sum, m) => {
    const t = matchKillTotals(m.players, {
      radiantScore: m.radiantScore,
      direScore: m.direScore,
    });
    return sum + t.radiantKills + t.direKills;
  }, 0);

  return (
    <div className="page matches-page">
      <SeasonArchiveBannerServer season={sp.season} />
      <PageHeader
        eyebrow="Results"
        title={view ? `Matches · Season ${view.number}` : "Matches"}
        subtitle={`${views.length} recorded · ${totalKills} kills logged`}
      />
      <MatchesGrid matches={views} />
    </div>
  );
}
