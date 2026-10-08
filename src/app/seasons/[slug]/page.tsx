import Link from "next/link";
import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { PUBLIC_PAGE_TAG, PUBLIC_REVALIDATE_SECONDS } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/common";
import { PlayerInsightAwardsGrid } from "@/components/player-insight-awards";
import { CUP_NAME, PUBG_CUP_NAME } from "@/lib/brand";
import { getPublicPlayerInsight } from "@/lib/player-insight";
import {
  getSeasonHistory,
  type SeasonHistoryRow,
} from "@/lib/seasons";
import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";

export const revalidate = 30;

function parseSeasonSlug(slug: string): { number: number; game: string | null } | null {
  const trimmed = slug.trim().toLowerCase();
  const tagged = trimmed.match(/^(pubg|dota)-(\d+)$/);
  if (tagged) {
    return { number: Number(tagged[2]), game: tagged[1]!.toUpperCase() };
  }
  const match = trimmed.match(/^season-(\d+)$/) ?? trimmed.match(/^(\d+)$/);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isFinite(number) && number > 0 ? { number, game: null } : null;
}

function findCompletedSeason(
  seasons: SeasonHistoryRow[],
  parsed: { number: number; game: string | null },
): SeasonHistoryRow | null {
  const matches = seasons.filter(
    (row) =>
      row.number === parsed.number &&
      (parsed.game ? row.game === parsed.game : true),
  );
  if (parsed.game) return matches[0] ?? null;
  return matches.length === 1 ? matches[0]! : null;
}

const loadArchiveSeason = unstable_cache(
  async (number: number, game: string | null) => {
    const parsed = { number, game };
    const [seasons, early] = await Promise.all([
      getSeasonHistory(),
      findArchiveSeasonId(parsed).then(async (id) =>
        id ? { id, insights: await getPublicPlayerInsight({ seasonId: id }) } : null,
      ),
    ]);
    const season = findCompletedSeason(seasons, parsed);
    if (!season) return null;
    const insights =
      early?.id === season.id
        ? early.insights
        : await getPublicPlayerInsight({ seasonId: season.id });
    return {
      season: {
        id: season.id,
        number: season.number,
        game: season.game,
        name: season.name,
        champion: season.champion,
      },
      insights,
    };
  },
  ["season-archive-page"],
  { tags: [PUBLIC_PAGE_TAG], revalidate: PUBLIC_REVALIDATE_SECONDS },
);

async function findArchiveSeasonId(parsed: {
  number: number;
  game: string | null;
}) {
  const rows = await prisma.season.findMany({
    where: {
      number: parsed.number,
      ...(parsed.game ? { game: parsed.game } : {}),
    },
    select: { id: true },
    take: 2,
  });
  return rows.length === 1 ? rows[0]!.id : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseSeasonSlug(slug);
  if (!parsed) return { title: "Season" };
  const gameLabel = parsed.game === "PUBG" ? "PUBG" : parsed.game === "DOTA" ? "Dota" : "";
  return pageMeta(
    `${gameLabel ? `${gameLabel} ` : ""}Season ${parsed.number}`,
    `Season ${parsed.number} champion and player insight for ${parsed.game === "PUBG" ? PUBG_CUP_NAME : CUP_NAME}.`,
  );
}

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const parsed = parseSeasonSlug(slug);
  if (!parsed) notFound();

  const archive = await loadArchiveSeason(parsed.number, parsed.game);
  if (!archive) notFound();
  const { season, insights } = archive;
  const insightsHasAny =
    Boolean(insights.playerOfTournament) ||
    Boolean(insights.mostKills) ||
    Boolean(insights.mostAssists) ||
    Boolean(insights.mostDeaths) ||
    Boolean(insights.highestBid) ||
    Boolean(insights.mostCorrectPredictions);

  const starters =
    season.champion?.players.filter((player) => !player.isSub) ?? [];
  const subs = season.champion?.players.filter((player) => player.isSub) ?? [];

  return (
    <div className="page seasons-page">
      <Link href="/seasons" className="back-link">
        ← All seasons
      </Link>

      <PageHeader
        eyebrow="Archive"
        title={`${season.game === "PUBG" ? "PUBG" : "Dota"} Season ${season.number}`}
        subtitle={`${season.name} — who won, and player insight awards.`}
        pills={[
          {
            value: season.champion ? "Champions" : "Complete",
            label: "status",
          },
        ]}
      />

      <article className="season-history-card mb-8">
        <header>
          <p className="eyebrow">
            Champions
            <span className="badge badge-gold">Complete</span>
          </p>
          <h2>Season {season.number}</h2>
        </header>

        {season.champion ? (
          <>
            <p className="season-history-winner">
              Champion{" "}
              <Link href={`/teams/${season.champion.id}?season=${season.number}`}>
                {season.champion.name}
              </Link>
            </p>
            {starters.length > 0 ? (
              <ul className="season-history-roster">
                {starters.map((player) => (
                  <li key={player.id}>
                    <Link href={`/players/${player.id}?season=${season.id}`}>
                      {player.steamName}
                      {player.isCaptain ? " (C)" : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Roster was not saved for this team.</p>
            )}
            {subs.length > 0 ? (
              <p className="muted season-history-subs">
                Subs{" "}
                {subs.map((player, index) => (
                  <span key={player.id}>
                    {index > 0 ? " · " : ""}
                    <Link href={`/players/${player.id}?season=${season.id}`}>
                      {player.steamName}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null}
          </>
        ) : (
          <p className="muted">No champion recorded for this season.</p>
        )}
      </article>

      <section aria-label={`Season ${season.number} player insight`}>
        <div className="section-head">
          <h2>Player insight</h2>
          <p className="m-0 text-sm text-muted-foreground">
            Season {season.number} awards — kills, assists, auction, predictions,
            and player of the tournament.
          </p>
        </div>
        {insightsHasAny ? (
          <PlayerInsightAwardsGrid awards={insights} />
        ) : (
          <p className="m-0 text-sm text-muted-foreground">
            No scoreboard or auction highlights stored for this season yet.
          </p>
        )}
      </section>
    </div>
  );
}
