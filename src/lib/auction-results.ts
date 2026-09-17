import { MEDAL_LABELS, formatPoints } from "./constants";
import { formatRoles } from "./data";
import { isLiveCupTeam, publicAuctionLotWhere, publicTeamWhere } from "./dummy";
import { prisma } from "./prisma";
import { parseRolesJson } from "./roles";
import { getCurrentSeasonSafe } from "./seasons";

/** Unsold lots that later joined a roster are listed at this bid. */
export const UNSOLD_LOT_PRICE = 2000;

export type AuctionSaleRow = {
  lotId: string;
  playerId: string;
  playerName: string;
  medal: string;
  medalLabel: string;
  rolesLabel: string;
  teamId: string;
  teamName: string;
  soldPrice: number;
  soldPriceLabel: string;
  soldAt: Date;
  highest: boolean;
  reserve: boolean;
};

export type SeasonAuctionBlock = {
  seasonId: string;
  number: number;
  name: string;
  status: string;
  live: boolean;
  soldCount: number;
  spent: number;
  spentLabel: string;
  sales: AuctionSaleRow[];
};

function medalLabel(medal: string) {
  return MEDAL_LABELS[medal as keyof typeof MEDAL_LABELS] ?? medal;
}

export async function getAuctionResultsBySeason(): Promise<SeasonAuctionBlock[]> {
  const [lots, teams, current] = await Promise.all([
    prisma.auctionLot.findMany({
      where: {
        AND: [publicAuctionLotWhere, { player: { teamId: { not: null } } }],
      },
      include: {
        player: {
          select: {
            id: true,
            steamName: true,
            medal: true,
            rolesJson: true,
            teamId: true,
            isCaptain: true,
            team: { select: { id: true, name: true, captainId: true } },
          },
        },
        team: { select: { id: true, name: true, captainId: true } },
        season: { select: { id: true, number: true, name: true, status: true } },
      },
    }),
    prisma.team.findMany({
      where: publicTeamWhere,
      select: { captainId: true },
    }),
    getCurrentSeasonSafe(),
  ]);

  const captainIds = new Set(teams.map((team) => team.captainId));
  const groups = new Map<
    string,
    {
      seasonId: string;
      number: number;
      name: string;
      status: string;
      live: boolean;
      sales: AuctionSaleRow[];
    }
  >();

  for (const lot of lots) {
    const rosterTeam =
      lot.player.team && isLiveCupTeam(lot.player.team) ? lot.player.team : null;
    const lotTeam = lot.team && isLiveCupTeam(lot.team) ? lot.team : null;
    const team = rosterTeam ?? lotTeam;
    if (!team || !lot.player.teamId) continue;
    if (
      lot.player.isCaptain ||
      lot.player.id === team.captainId ||
      captainIds.has(lot.player.id)
    ) {
      continue;
    }

    const soldPrice =
      lot.status === "sold" && lot.soldPrice != null
        ? lot.soldPrice
        : UNSOLD_LOT_PRICE;
    const soldBid = lot.status === "sold" && lot.soldPrice != null;

    const seasonId = lot.season?.id ?? lot.seasonId ?? "unassigned";
    const number = lot.season?.number ?? 0;
    const name =
      lot.season?.name ?? (number > 0 ? `Season ${number}` : "Unassigned");
    const status = lot.season?.status ?? "archived";
    let group = groups.get(seasonId);
    if (!group) {
      group = {
        seasonId,
        number,
        name,
        status,
        live: current?.id === lot.season?.id,
        sales: [],
      };
      groups.set(seasonId, group);
    }

    const nextSale: AuctionSaleRow = {
      lotId: lot.id,
      playerId: lot.player.id,
      playerName: lot.player.steamName,
      medal: lot.role || lot.player.medal,
      medalLabel: medalLabel(lot.role || lot.player.medal),
      rolesLabel: formatRoles(parseRolesJson(lot.player.rolesJson)),
      teamId: team.id,
      teamName: team.name,
      soldPrice,
      soldPriceLabel: formatPoints(soldPrice),
      soldAt: lot.createdAt,
      highest: false,
      reserve: !soldBid,
    };
    const existing = group.sales.findIndex(
      (sale) => sale.playerId === nextSale.playerId,
    );
    if (existing >= 0) {
      const currentSale = group.sales[existing];
      if (currentSale.reserve && !nextSale.reserve) {
        group.sales[existing] = nextSale;
      }
      continue;
    }

    group.sales.push(nextSale);
  }

  return [...groups.values()]
    .filter((group) => group.sales.length > 0)
    .sort((a, b) => b.number - a.number || a.name.localeCompare(b.name))
    .map((group) => {
      const sales = [...group.sales].sort(
        (a, b) =>
          b.soldPrice - a.soldPrice || a.playerName.localeCompare(b.playerName),
      );
      const top = sales[0]?.soldPrice ?? 0;
      const ranked = sales.map((sale) => ({
        ...sale,
        highest: top > 0 && sale.soldPrice === top,
      }));
      const spent = ranked.reduce((sum, sale) => sum + sale.soldPrice, 0);
      return {
        seasonId: group.seasonId,
        number: group.number,
        name: group.name,
        status: group.status,
        live: group.live,
        soldCount: ranked.length,
        spent,
        spentLabel: formatPoints(spent),
        sales: ranked,
      };
    });
}
