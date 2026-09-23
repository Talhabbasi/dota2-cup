import { PageHeader } from "@/components/common";
import {
  AuctionBoard,
  type AuctionCaptainCard,
} from "@/components/auction-board";
import { getAuctionResultsBySeason } from "@/lib/auction-results";
import { STARTING_PURSE, formatPoints } from "@/lib/constants";
import { getTeams } from "@/lib/data";
import { isRosterSub } from "@/lib/roles";
import { pageMeta } from "@/lib/seo";

export const revalidate = 30;

export const metadata = pageMeta(
  "Player Auction",
  "See which MM Dota Cup players sold to which team and for how many points in the season auction.",
);

export default async function AuctionPage() {
  const [seasons, teams] = await Promise.all([
    getAuctionResultsBySeason(),
    getTeams(),
  ]);

  const soldCount = seasons.reduce((sum, season) => sum + season.soldCount, 0);
  const spent = seasons.reduce((sum, season) => sum + season.spent, 0);

  const liveSeason = seasons.find((s) => s.live);
  const highBid =
    liveSeason && liveSeason.sales.length > 0
      ? [...liveSeason.sales].sort((a, b) => b.soldPrice - a.soldPrice)[0] ??
        null
      : null;

  const spentByTeam = new Map<string, number>();
  if (liveSeason) {
    for (const sale of liveSeason.sales) {
      spentByTeam.set(
        sale.teamId,
        (spentByTeam.get(sale.teamId) ?? 0) + sale.soldPrice,
      );
    }
  }

  const captains: AuctionCaptainCard[] = teams.map((team) => {
    const captain = team.players.find((p) => p.isCaptain);
    const starterCount = team.players.filter(
      (p) => !isRosterSub(p.rosterRole),
    ).length;
    const fromSales = spentByTeam.get(team.id);
    const spentFromPurse = Math.max(0, STARTING_PURSE - team.purse);
    return {
      id: team.id,
      name: team.name,
      captainName: captain?.steamName ?? null,
      purse: team.purse,
      starterCount,
      spent: fromSales ?? spentFromPurse,
    };
  });

  return (
    <div className="page auction-page">
      <PageHeader
        eyebrow="Transfer market"
        title="Auction"
        subtitle="Who sold, which franchise won the lot, and the winning bid — season by season. Captains are not in the auction."
        pills={
          soldCount > 0
            ? [
                { value: soldCount, label: "sold" },
                { value: formatPoints(spent), label: "points spent" },
              ]
            : undefined
        }
      />

      <AuctionBoard
        seasons={seasons}
        captains={captains}
        highBid={highBid}
      />
    </div>
  );
}
