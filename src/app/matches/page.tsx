import { PageHeader } from "@/components/common";
import { MatchesGrid, type MatchListView } from "@/components/matches-grid";
import { SeasonArchiveBannerServer } from "@/components/season-archive-banner-server";
import { loadMatchesForSeason } from "@/lib/season-data";
import { matchKillTotals } from "@/lib/match-score";
import { listPubgLobbies } from "@/lib/pubg-lobby";
import { matchPoints } from "@/lib/pubg-scoring";
import { getPublicSeasonContext } from "@/lib/season-page";
import { livePageMeta } from "@/lib/seo";

export const revalidate = 30;

export function generateMetadata() {
  return livePageMeta("Match Results", (brand) =>
    brand.game === "PUBG"
      ? `${brand.name} lobby results — placements, kills, and points for the live season.`
      : `${brand.name} match results, scores, and Dota 2 series history for the live indoor season.`,
  );
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sp = await searchParams;
  const { view, seasonId } = await getPublicSeasonContext(sp);
  if (view?.game === "PUBG" && seasonId) {
    const lobbies = (await listPubgLobbies(seasonId)).filter(
      (lobby) => lobby.status !== "scheduled",
    );
    return (
      <div className="page matches-page">
        <SeasonArchiveBannerServer season={sp.season} />
        <PageHeader
          eyebrow="Results"
          title={`${view.name} · lobbies`}
          subtitle="Played rooms for the active season. Points are placement plus one per kill."
        />
        {lobbies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No played lobbies yet.</p>
        ) : (
          <div className="grid gap-4">
            {lobbies.map((lobby) => (
              <section key={lobby.id} className="rounded-lg border border-white/10 p-4">
                <h2 className="mt-0 mb-2 text-lg">
                  {lobby.label || "Lobby"} · {lobby.map}
                </h2>
                <ul className="m-0 grid list-none gap-1 p-0 text-sm">
                  {lobby.teams
                    .filter((row) => row.placement != null)
                    .map((row) => (
                      <li key={row.id}>
                        #{row.placement} {row.team.name} · {row.kills} kills ·{" "}
                        {matchPoints(row.placement ?? 0, row.kills)} pts
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    );
  }
  const matches = seasonId ? await loadMatchesForSeason(seasonId) : [];

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
