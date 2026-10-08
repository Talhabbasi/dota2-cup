import { PageHeader } from "@/components/common";
import { PlayerInsightAwardsGrid } from "@/components/player-insight-awards";
import { isPubgSeason } from "@/lib/games";
import { pubgPlayerAwards } from "@/lib/pubg-lobby";
import { getPublicPlayerInsight } from "@/lib/player-insight";
import { getSeasonByIdOrNumber, getLiveSeason } from "@/lib/seasons";
import { livePageMeta } from "@/lib/seo";
import Link from "next/link";

export const revalidate = 30;

export function generateMetadata() {
  return livePageMeta(
    "Player Insight",
    (brand) =>
      `Season highlights for ${brand.name}: kills, assists, deaths, team totals, auction, predictions, and player of the tournament.`,
  );
}

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
  if (isPubgSeason(season) && season) {
    const awards = await pubgPlayerAwards(season.id);
    const cards = [
      ["Most kills", awards.mostKills, awards.mostKills ? `${awards.mostKills.kills} kills` : ""],
      ["Most damage", awards.mostDamage, awards.mostDamage ? `${awards.mostDamage.damage} damage` : ""],
      ["Chicken dinners", awards.mostChickenDinners, awards.mostChickenDinners ? `${awards.mostChickenDinners.wwcd} wins` : ""],
    ] as const;
    return (
      <div className="page">
        <PageHeader
          eyebrow={`Season ${season.number}`}
          title="Player Insight"
          subtitle="Kills and damage come from lobby results. Each kill is 1 team point. Damage does not add points."
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {cards.map(([title, row, value]) => (
            <article key={title} className="rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="m-0 text-xs tracking-wide text-muted-foreground uppercase">{title}</p>
              <p className="mt-2 mb-0 text-lg font-semibold">{row?.name ?? "—"}</p>
              <p className="mt-1 mb-0 text-sm text-muted-foreground">
                {row ? `${value}${row.teamName ? ` · ${row.teamName}` : ""}` : "No lobby stats yet."}
              </p>
            </article>
          ))}
        </div>
      </div>
    );
  }
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
