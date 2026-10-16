import { PageHeader } from "@/components/common";
import {
  AuctionResultsClient,
  type AuctionResultsTeamSummary,
  type SoldPlayerCardData,
} from "@/components/auction";
import { AuctionBoard, type AuctionCaptainCard } from "@/components/auction-board";
import { getAuctionResultsBySeason } from "@/lib/auction-results";
import { STARTING_PURSE, formatPoints } from "@/lib/constants";
import { getCupFeatureSettings } from "@/lib/cup-features";
import { getTeams } from "@/lib/data";
import { isRosterSub, parseRolesJson } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { getCurrentSeasonSafe } from "@/lib/seasons";
import { formatRoles } from "@/lib/format";
import { labelForMedal } from "@/lib/constants";
import { livePageMeta } from "@/lib/seo";
import Link from "next/link";

export const revalidate = 30;

export function generateMetadata() {
  return livePageMeta(
    "Auction Results",
    (brand) =>
      `See which ${brand.name} players sold to which team and for how many points in the season auction.`,
  );
}

export default async function AuctionResultsPage() {
  const { auctionEnabled } = await getCupFeatureSettings();
  if (!auctionEnabled) {
    return (
      <div className="page">
        <PageHeader
          eyebrow="Auction"
          title="Auction results"
          subtitle="This cup assigns players without an auction."
        />
        <div className="empty-panel teams-list-empty">
          <p className="muted" style={{ margin: 0 }}>
            Auction is off for this cup.
          </p>
        </div>
      </div>
    );
  }

  const [seasons, teams, current] = await Promise.all([
    getAuctionResultsBySeason(),
    getTeams(),
    getCurrentSeasonSafe(),
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

  const soldPlayers: SoldPlayerCardData[] =
    liveSeason?.sales.map((sale) => ({
      playerId: sale.playerId,
      playerName: sale.playerName,
      medalLabel: sale.medalLabel,
      rolesLabel: sale.rolesLabel,
      teamId: sale.teamId,
      teamName: sale.teamName,
      soldPrice: sale.soldPrice,
      sold: true,
    })) ?? [];

  let unsoldPlayers: SoldPlayerCardData[] = [];
  if (current) {
    const pool = await prisma.seasonPlayer.findMany({
      where: {
        seasonId: current.id,
        teamId: null,
        player: { isCaptain: false },
      },
      select: {
        player: {
          select: {
            id: true,
            steamName: true,
            medal: true,
            rolesJson: true,
            auctionStatus: true,
            basePrice: true,
          },
        },
      },
      take: 200,
    });
    unsoldPlayers = pool.map((row) => ({
      playerId: row.player.id,
      playerName: row.player.steamName,
      medalLabel: labelForMedal(row.player.medal),
      rolesLabel: formatRoles(parseRolesJson(row.player.rolesJson)),
      teamId: null,
      teamName: null,
      soldPrice: row.player.basePrice,
      sold: false,
    }));
  }

  const allPlayers = [...soldPlayers, ...unsoldPlayers];

  const teamSummaries: AuctionResultsTeamSummary[] = teams.map((team) => ({
    id: team.id,
    name: team.name,
    purse: team.purse,
    players: soldPlayers.filter((p) => p.teamId === team.id),
  }));

  return (
    <div className="page auction-page">
      <PageHeader
        eyebrow="Transfer market"
        title="Auction results"
        subtitle={
          <>
            Who sold, which franchise won the lot, and the winning bid.{" "}
            <Link href="/auction" className="text-link">
              Live board
            </Link>{" "}
            ·{" "}
            <Link href="/auction/captain" className="text-link">
              Captain desk
            </Link>
          </>
        }
        pills={
          soldCount > 0
            ? [
                { value: soldCount, label: "sold" },
                { value: formatPoints(spent), label: "points spent" },
              ]
            : undefined
        }
      />

      <AuctionResultsClient players={allPlayers} teams={teamSummaries} />

      <div className="mt-10">
        <AuctionBoard
          seasons={seasons}
          captains={captains}
          highBid={highBid}
        />
      </div>
    </div>
  );
}
