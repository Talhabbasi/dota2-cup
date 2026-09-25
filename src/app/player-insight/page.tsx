import { PageHeader } from "@/components/common";
import { PlayerInsightAwardsGrid } from "@/components/player-insight-awards";
import { CUP_NAME } from "@/lib/brand";
import { getPublicPlayerInsight } from "@/lib/player-insight";
import { pageMeta } from "@/lib/seo";

export const revalidate = 30;

export const metadata = pageMeta(
  "Player Insight",
  `Season highlights for ${CUP_NAME}: kills, assists, deaths, team totals, auction, predictions, and player of the tournament.`,
);

export default async function PlayerInsightPage() {
  const data = await getPublicPlayerInsight();

  return (
    <div className="page">
      <PageHeader
        eyebrow="Highlights"
        title="Player Insight"
        subtitle="One winner per board. Roster and stand-in games stay separate totals, but stand-ins can take the top spot if they lead. Assists are weighted so supports can win player of the tournament."
        pills={
          data.playerOfTournament
            ? [
                {
                  value: data.playerOfTournament.name,
                  label: "player of the tournament",
                },
              ]
            : undefined
        }
      />
      <PlayerInsightAwardsGrid awards={data} />
    </div>
  );
}
