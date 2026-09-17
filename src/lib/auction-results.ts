import { MEDAL_LABELS, formatPoints } from "./constants";
import { formatRoles } from "./data";
import { isLiveCupTeam, publicAuctionLotWhere, publicPlayerWhere, publicTeamWhere } from "./dummy";
import { prisma } from "./prisma";
import { parseRolesJson } from "./roles";
import { getCurrentSeasonSafe } from "./seasons";

/** Unsold lots that later joined a roster are listed at this bid. */
export const UNSOLD_LOT_PRICE = 2000;

export type AuctionCaptainRow = {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
};

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
  captains: AuctionCaptainRow[];
  sales: AuctionSaleRow[];
};

function medalLabel(medal: string) {
  return MEDAL_LABELS[medal as keyof typeof MEDAL_LABELS] ?? medal;
}

function isCaptainOfTeam(
  player: { id: string; isCaptain: boolean },
  team: { captainId: string },
) {
  return player.isCaptain || player.id === team.captainId;
}

type SeasonBucket = {
  seasonId: string;
  number: number;
  name: string;
  status: string;
  live: boolean;
  captains: AuctionCaptainRow[];
  sales: AuctionSaleRow[];
};

function seasonKey(input: {
  seasonId: string | null | undefined;
  season: { id: string; number: number; name: string; status: string } | null;
}) {
  const number = input.season?.number ?? 0;
  return {
    seasonId: input.season?.id ?? input.seasonId ?? "unassigned",
    number,
    name:
      input.season?.name ?? (number > 0 ? `Season ${number}` : "Unassigned"),
    status: input.season?.status ?? "archived",
  };
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
      select: {
        id: true,
        name: true,
        captainId: true,
        seasonId: true,
        season: { select: { id: true, number: true, name: true, status: true } },
        players: {
          where: publicPlayerWhere,
          select: { id: true, steamName: true, isCaptain: true },
        },
      },
    }),
    getCurrentSeasonSafe(),
  ]);

  const groups = new Map<string, SeasonBucket>();

  function bucketFor(meta: {
    seasonId: string;
    number: number;
    name: string;
    status: string;
    live: boolean;
  }) {
    let group = groups.get(meta.seasonId);
    if (!group) {
      group = { ...meta, captains: [], sales: [] };
      groups.set(meta.seasonId, group);
    }
    return group;
  }

  for (const team of teams) {
    if (!isLiveCupTeam(team)) continue;
    const captain =
      team.players.find((player) => isCaptainOfTeam(player, team)) ??
      team.players.find((player) => player.id === team.captainId);
    if (!captain) continue;
    const meta = seasonKey(team);
    bucketFor({
      ...meta,
      live: current?.id === team.season?.id,
    }).captains.push({
      playerId: captain.id,
      playerName: captain.steamName,
      teamId: team.id,
      teamName: team.name,
    });
  }

  for (const lot of lots) {
    const rosterTeam =
      lot.player.team && isLiveCupTeam(lot.player.team) ? lot.player.team : null;
    const lotTeam = lot.team && isLiveCupTeam(lot.team) ? lot.team : null;
    const team = rosterTeam ?? lotTeam;
    if (!team || !lot.player.teamId) continue;
    if (isCaptainOfTeam(lot.player, team)) continue;
    if (teams.some((row) => row.captainId === lot.player.id)) continue;

    const soldPrice =
      lot.status === "sold" && lot.soldPrice != null
        ? lot.soldPrice
        : UNSOLD_LOT_PRICE;
    const soldBid = lot.status === "sold" && lot.soldPrice != null;

    const meta = seasonKey(lot);
    const group = bucketFor({
      ...meta,
      live: current?.id === lot.season?.id,
    });

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
    const existing = group.sales.findIndex((sale) => sale.playerId === nextSale.playerId);
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
    .filter((group) => group.sales.length > 0 || group.captains.length > 0)
    .sort((a, b) => b.number - a.number || a.name.localeCompare(b.name))
    .map((group) => {
      const captains = [...group.captains].sort((a, b) =>
        a.playerName.localeCompare(b.playerName),
      );
      const sales = [...group.sales].sort(
        (a, b) => b.soldPrice - a.soldPrice || a.playerName.localeCompare(b.playerName),
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
        captains,
        sales: ranked,
      };
    });
}
