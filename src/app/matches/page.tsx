import { PageHeader } from "@/components/common";
import { MatchSeasonTabs } from "@/components/matches-grid";
import { SeasonSwitch } from "@/components/season-switch";
import { toMatchListView } from "@/lib/match-list-view";
import { SeasonArchiveBannerServer } from "@/components/season-archive-banner-server";
import { loadMatchesForSeasons } from "@/lib/season-data";
import { listPubgLobbies } from "@/lib/pubg-lobby";
import { matchPoints } from "@/lib/pubg-scoring";
import { getPublicSeasonContext } from "@/lib/season-page";
import { seriesContextLabel } from "@/lib/series-label";
import { livePageMeta } from "@/lib/seo";
import { CUP_GAME, type CupGame } from "@/lib/games";

export const revalidate = 30;

export function generateMetadata() {
  return livePageMeta("Match Results", (brand) =>
    brand.game === "PUBG"
      ? `${brand.name} lobby results — placements, kills, and points.`
      : `${brand.name} match results across every Dota season — group stage, brackets, and grand finals.`,
  );
}

function seasonHeading(game: string, number: number, name: string) {
  const gameLabel = game === "PUBG" ? "PUBG" : "Dota";
  return name && name !== `Season ${number}`
    ? `${gameLabel} · ${name}`
    : `${gameLabel} Season ${number}`;
}

export async function MatchesScreen({
  searchParams,
  game,
}: {
  searchParams: { season?: string };
  game?: CupGame;
}) {
  const { seasons, game: scoped } = await getPublicSeasonContext(searchParams, game);
  const isPubg = scoped === CUP_GAME.PUBG;

  if (isPubg && seasons.length > 0 && seasons.every((row) => row.game === "PUBG")) {
    const blocks = await Promise.all(
      seasons.map(async (season) => ({
        season,
        lobbies: (await listPubgLobbies(season.id)).filter(
          (lobby) => lobby.status !== "scheduled",
        ),
      })),
    );
    return (
      <div className="page matches-page">
        <SeasonArchiveBannerServer season={searchParams.season} />
        <PageHeader
          eyebrow="Results"
          title="Matches"
          subtitle="Open a season tab. Each tab is only that season’s lobbies. Points are placement plus one per kill."
        />
        <SeasonSwitch
          ariaLabel="Season matches"
          labels={blocks.map((block) => `Season ${block.season.number} matches`)}
          notes={blocks.map((block) => seasonHeading(block.season.game, block.season.number, block.season.name))}
        >
          {blocks.map(({ season, lobbies }) => (
            <section key={season.id}>
              {lobbies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No played lobbies yet.</p>
              ) : (
                <div className="grid gap-4">
                  {lobbies.map((lobby) => (
                    <section key={lobby.id} className="rounded-lg border border-white/10 p-4">
                      <h3 className="mt-0 mb-2 text-lg">
                        {lobby.label || "Lobby"} · {lobby.map}
                      </h3>
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
            </section>
          ))}
        </SeasonSwitch>
      </div>
    );
  }

  const rows = await loadMatchesForSeasons(seasons.map((season) => season.id));
  const seen = new Set<string>();
  const views = rows.flatMap((match) => {
    const key = `${match.season?.id ?? ""}:${match.openDotaId || match.id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const fixture = match.seriesFixture ?? match.scheduledFixture;
    return [
      toMatchListView({
        id: match.id,
        openDotaId: match.openDotaId,
        duration: match.duration,
        radiantWin: match.radiantWin,
        radiantScore: match.radiantScore,
        direScore: match.direScore,
        radiantTeam: match.radiantTeam,
        direTeam: match.direTeam,
        winnerTeam: match.winnerTeam,
        players: match.players,
        createdAt: match.createdAt,
        bestOf: fixture?.bestOf ?? 1,
        roundLabel: seriesContextLabel({
          kind: fixture?.kind,
          slotKey: fixture?.slotKey,
          bestOf: fixture?.bestOf,
          gameNumber: match.gameNumber,
        }),
        seasonId: match.season?.id ?? null,
        seasonLabel: match.season
          ? seasonHeading(match.season.game, match.season.number, match.season.name)
          : null,
      }),
    ];
  });
  const sections = seasons.map((season) => ({
    id: season.id,
    label: `Season ${season.number} matches`,
    note: seasonHeading(season.game, season.number, season.name),
    matches: views.filter((match) => match.seasonId === season.id),
  }));

  return (
    <div className="page matches-page">
      <SeasonArchiveBannerServer season={searchParams.season} />
      <PageHeader
        eyebrow="Results"
        title="Matches"
        subtitle="Each tab is one season. A map line is its series: Bo1, UB, lower-bracket elimination, or Grand Final Bo3."
      />
      <MatchSeasonTabs sections={sections} />
    </div>
  );
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sp = await searchParams;
  return <MatchesScreen searchParams={sp} />;
}
