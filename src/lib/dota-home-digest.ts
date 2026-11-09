import { GAME_HOME_HREF } from "@/lib/brand";
import { publicFixtureWhere, publicMatchWhere } from "@/lib/dummy";
import { parseCupGame } from "@/lib/games";
import { prisma } from "@/lib/prisma";
import { championRosterArt } from "@/lib/season-champion-art";
import {
  SEASON_PHASE,
  SEASON_STATUS,
  seasonPlanLine,
} from "@/lib/season-constants";
import { seriesContextLabel } from "@/lib/series-label";
import { listPublicSeasons, type PublicSeasonRow } from "@/lib/seasons";

const RECENT_MATCH_LIMIT = 6;

export type DigestMatch = {
  id: string;
  href: string;
  radiant: string;
  dire: string;
  winner: string | null;
  kills: string | null;
  detail: string;
};

export type DigestSeason = {
  id: string;
  href: string;
  title: string;
  stateLabel: string;
  plan: string;
  championName: string | null;
  finalLine: string | null;
  image: string | null;
  imageAlt: string;
  matches: DigestMatch[];
  matchCount: number;
  matchesHref: string;
};

export type GameHomeDigest = {
  coming: DigestSeason[];
  recent: DigestSeason[];
};

function seasonTitle(row: PublicSeasonRow) {
  const named = row.name.trim();
  if (named && named !== `Season ${row.number}`) return named;
  const game = parseCupGame(row.game) === "PUBG" ? "PUBG" : "Dota";
  return `${game} Season ${row.number}`;
}

function isComplete(row: PublicSeasonRow) {
  return (
    row.status === SEASON_STATUS.archived ||
    row.phase === SEASON_PHASE.COMPLETED ||
    row.endedAt != null
  );
}

function stateLabel(row: PublicSeasonRow) {
  if (isComplete(row)) return "Complete";
  if (
    row.phase === SEASON_PHASE.UPCOMING ||
    row.status === SEASON_STATUS.upcoming
  ) {
    return "Coming up";
  }
  if (row.phase === SEASON_PHASE.AUCTION_ACTIVE) return "Auction open";
  return "Live now";
}

function coverFor(row: PublicSeasonRow) {
  const art = championRosterArt(row.game, row.number);
  if (art) return { src: art.src, alt: art.alt };
  if (parseCupGame(row.game) === "PUBG") {
    return { src: "/pubg/desert.jpg", alt: "" };
  }
  return { src: "/hero-slides/dota-2-windranger-radiant.jpg", alt: "" };
}

function planFor(row: PublicSeasonRow) {
  return seasonPlanLine({
    number: row.number,
    teamCount: row.teamCount,
    plannedStartAt: row.plannedStartAt,
    startedAt: row.startedAt,
    phase: row.phase,
  });
}

export async function loadGameHomeDigest(): Promise<GameHomeDigest> {
  const seasons = await listPublicSeasons();
  const recentRows = seasons.filter(isComplete);
  const comingRows = seasons.filter((row) => !isComplete(row));
  const recentIds = recentRows.map((row) => row.id);

  const [fixtures, matches] = await Promise.all([
    recentIds.length
      ? prisma.scheduledFixture.findMany({
          where: {
            AND: [
              { seasonId: { in: recentIds } },
              { status: "completed" },
              { OR: [{ kind: "final" }, { slotKey: "final" }] },
              publicFixtureWhere,
            ],
          },
          select: {
            seasonId: true,
            radiantWins: true,
            direWins: true,
            scheduledAt: true,
            radiantTeam: { select: { name: true } },
            direTeam: { select: { name: true } },
          },
          orderBy: { scheduledAt: "desc" },
        })
      : Promise.resolve([]),
    recentIds.length
      ? prisma.match.findMany({
          where: {
            AND: [{ seasonId: { in: recentIds } }, publicMatchWhere],
          },
          select: {
            id: true,
            openDotaId: true,
            seasonId: true,
            radiantScore: true,
            direScore: true,
            createdAt: true,
            gameNumber: true,
            radiantTeam: { select: { name: true } },
            direTeam: { select: { name: true } },
            winnerTeam: { select: { name: true } },
            scheduledFixture: {
              select: { kind: true, slotKey: true, bestOf: true },
            },
            seriesFixture: {
              select: { kind: true, slotKey: true, bestOf: true },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const finalBySeason = new Map<string, (typeof fixtures)[number]>();
  for (const fixture of fixtures) {
    if (fixture.seasonId && !finalBySeason.has(fixture.seasonId)) {
      finalBySeason.set(fixture.seasonId, fixture);
    }
  }

  const matchesBySeason = new Map<string, DigestMatch[]>();
  const seen = new Set<string>();
  for (const match of matches) {
    if (!match.seasonId) continue;
    const key = match.openDotaId || match.id;
    const dedupeKey = `${match.seasonId}:${key}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const radiant = match.radiantTeam?.name ?? "Radiant";
    const dire = match.direTeam?.name ?? "Dire";
    const kills =
      match.radiantScore != null && match.direScore != null
        ? `${match.radiantScore}–${match.direScore}`
        : null;
    const fixture = match.seriesFixture ?? match.scheduledFixture;
    const list = matchesBySeason.get(match.seasonId) ?? [];
    list.push({
      id: match.id,
      href: `/matches/${match.id}`,
      radiant,
      dire,
      winner: match.winnerTeam?.name ?? null,
      kills,
      detail: seriesContextLabel({
        kind: fixture?.kind,
        slotKey: fixture?.slotKey,
        bestOf: fixture?.bestOf,
        gameNumber: match.gameNumber,
      }),
    });
    matchesBySeason.set(match.seasonId, list);
  }

  function toDigest(row: PublicSeasonRow, withMatches: boolean): DigestSeason {
    const cover = coverFor(row);
    const final = finalBySeason.get(row.id);
    const seriesWinner = final
      ? final.radiantWins > final.direWins
        ? final.radiantTeam.name
        : final.direWins > final.radiantWins
          ? final.direTeam.name
          : null
      : null;
    const allMatches = withMatches ? (matchesBySeason.get(row.id) ?? []) : [];
    const game = parseCupGame(row.game);
    return {
      id: row.id,
      href:
        withMatches && isComplete(row)
          ? `/seasons/${game.toLowerCase()}-${row.number}`
          : GAME_HOME_HREF[game],
      title: seasonTitle(row),
      stateLabel: stateLabel(row),
      plan: planFor(row),
      championName: row.championName,
      finalLine: final
        ? `Grand final ${final.radiantTeam.name} ${final.radiantWins}–${final.direWins} ${final.direTeam.name}${seriesWinner ? ` · ${seriesWinner} won` : ""}`
        : null,
      image: cover.src,
      imageAlt: cover.alt,
      matches: allMatches.slice(0, RECENT_MATCH_LIMIT),
      matchCount: allMatches.length,
      matchesHref: `/${game.toLowerCase()}/matches`,
    };
  }

  return {
    coming: comingRows.map((row) => toDigest(row, false)),
    recent: recentRows.map((row) => toDigest(row, true)),
  };
}
