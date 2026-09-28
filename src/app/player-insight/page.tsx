import { PageHeader } from "@/components/common";
import { PlayerInsightAwardsGrid } from "@/components/player-insight-awards";
import { CUP_NAME } from "@/lib/brand";
import { getPublicPlayerInsight } from "@/lib/player-insight";
import { getSeasonByIdOrNumber, getLiveSeason } from "@/lib/seasons";
import { pageMeta } from "@/lib/seo";
import Link from "next/link";

export const revalidate = 30;

export const metadata = pageMeta(
  "Player Insight",
  `Season highlights for ${CUP_NAME}: kills, assists, deaths, team totals, auction, predictions, and player of the tournament.`,
);

export default async function PlayerInsightPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const params = await searchParams;
  const seasonParam = params.season?.trim() || null;
  const [live, focused] = await Promise.all([
    getLiveSeason(),
    seasonParam ? getSeasonByIdOrNumber(seasonParam) : Promise.resolve(null),
  ]);
  const season = focused ?? live;
  const data = await getPublicPlayerInsight({
    seasonId: season?.id ?? null,
  });
  const hasAny =
    Boolean(data.playerOfTournament) ||
    Boolean(data.mostKills) ||
    Boolean(data.mostAssists) ||
    Boolean(data.highestBid);

  const seasonLabel = season ? `Season ${season.number}` : null;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Highlights"
        title="Player Insight"
        subtitle={
          hasAny
            ? `${seasonLabel ?? "Season"} awards. Roster and stand-in games stay separate; assists are weighted so supports can win player of the tournament.`
            : "Awards appear when matches are played for this season."
        }
        pills={
          data.playerOfTournament
            ? [
                {
                  value: data.playerOfTournament.name,
                  label: "player of the tournament",
                },
              ]
            : seasonLabel
              ? [{ value: seasonLabel, label: "season" }]
              : undefined
        }
      />
      {hasAny ? (
        <PlayerInsightAwardsGrid awards={data} />
      ) : (
        <p className="m-0 text-sm text-muted-foreground">
          No stats for {seasonLabel ?? "this season"} yet.
          {season?.number ? (
            <>
              {" "}
              <Link href={`/seasons?season=${season.number}`} className="text-link">
                Back to season summary
              </Link>
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}
