import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common";
import { PlayerInsightAwardsGrid } from "@/components/player-insight-awards";
import { CUP_NAME } from "@/lib/brand";
import { getPublicPlayerInsight } from "@/lib/player-insight";
import {
  getSeasonHistory,
  type SeasonHistoryRow,
} from "@/lib/seasons";
import { pageMeta } from "@/lib/seo";
import type { Metadata } from "next";

export const revalidate = 30;

function parseSeasonSlug(slug: string): number | null {
  const trimmed = slug.trim().toLowerCase();
  const match = trimmed.match(/^season-(\d+)$/) ?? trimmed.match(/^(\d+)$/);
  if (!match) return null;
  const number = Number(match[1]);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function findCompletedSeason(
  seasons: SeasonHistoryRow[],
  number: number,
): SeasonHistoryRow | null {
  return seasons.find((row) => row.number === number) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const number = parseSeasonSlug(slug);
  if (!number) return { title: "Season" };
  return pageMeta(
    `Season ${number}`,
    `Season ${number} champion and player insight for ${CUP_NAME}.`,
  );
}

export default async function SeasonDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const number = parseSeasonSlug(slug);
  if (!number) notFound();

  const seasons = await getSeasonHistory();
  const season = findCompletedSeason(seasons, number);
  if (!season) notFound();

  const insights = await getPublicPlayerInsight({ seasonId: season.id });
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
        title={`Season ${season.number}`}
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
