import { publicFixtureWhere, publicMatchWhere, publicTeamWhere } from "@/lib/dummy";
import { prisma } from "@/lib/prisma";
import { SEASON_PHASE, SEASON_STATUS } from "@/lib/season-constants";
import { seriesContextLabel } from "@/lib/series-label";
import { getLiveSeason, liveSeasonLabel } from "@/lib/seasons";

export type HubMatchStatus = "live" | "upcoming" | "completed";

export type HubMatchCard = {
  id: string;
  href: string;
  game: string;
  status: HubMatchStatus;
  left: string;
  right: string;
  score: string | null;
  when: string;
  detail: string;
};

export type HubOverview = {
  activeTournaments: number;
  registeredTeams: number;
  completedMatches: number;
  currentSeason: string;
  currentSeasonNote: string;
  live: HubMatchCard[];
  upcoming: HubMatchCard[];
  completed: HubMatchCard[];
};

function gameLabel(game: string | null | undefined) {
  return game === "PUBG" ? "PUBG" : "Dota 2";
}

function kickoffLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function teamName(name: string | null | undefined) {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "TBD";
}

export async function loadHubOverview(): Promise<HubOverview> {
  const now = new Date();
  const [liveSeason, activeTournaments, registeredTeams, recordedMaps, playedLobbies, liveFixtures, upcomingFixtures, recentMatches] =
    await Promise.all([
      getLiveSeason(),
      prisma.season.count({ where: { status: SEASON_STATUS.live } }),
      prisma.team.count({ where: publicTeamWhere }),
      prisma.match.count({ where: publicMatchWhere }),
      prisma.pubgLobby.count({ where: { status: "played" } }),
      prisma.scheduledFixture.findMany({
        where: { AND: [{ status: "live" }, publicFixtureWhere] },
        orderBy: { scheduledAt: "asc" },
        take: 4,
        select: {
          id: true,
          scheduledAt: true,
          bestOf: true,
          kind: true,
          slotKey: true,
          radiantWins: true,
          direWins: true,
          radiantTeam: { select: { name: true } },
          direTeam: { select: { name: true } },
          season: { select: { game: true } },
        },
      }),
      prisma.scheduledFixture.findMany({
        where: {
          AND: [
            { status: "scheduled" },
            { scheduledAt: { gte: now } },
            publicFixtureWhere,
          ],
        },
        orderBy: { scheduledAt: "asc" },
        take: 4,
        select: {
          id: true,
          scheduledAt: true,
          bestOf: true,
          kind: true,
          slotKey: true,
          radiantTeam: { select: { name: true } },
          direTeam: { select: { name: true } },
          season: { select: { game: true } },
        },
      }),
      prisma.match.findMany({
        where: publicMatchWhere,
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          openDotaId: true,
          radiantScore: true,
          direScore: true,
          createdAt: true,
          startedAt: true,
          gameNumber: true,
          radiantTeam: { select: { name: true } },
          direTeam: { select: { name: true } },
          season: { select: { game: true } },
          scheduledFixture: { select: { kind: true, slotKey: true, bestOf: true } },
          seriesFixture: { select: { kind: true, slotKey: true, bestOf: true } },
        },
      }),
    ]);

  const completed: HubMatchCard[] = [];
  const seen = new Set<string>();
  for (const match of recentMatches) {
    const key = match.openDotaId || match.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const series = match.seriesFixture ?? match.scheduledFixture;
    const hasScore =
      typeof match.radiantScore === "number" && typeof match.direScore === "number";
    completed.push({
      id: match.id,
      href: `/matches/${match.id}`,
      game: gameLabel(match.season?.game),
      status: "completed",
      left: teamName(match.radiantTeam?.name),
      right: teamName(match.direTeam?.name),
      score: hasScore ? `${match.radiantScore}–${match.direScore}` : null,
      when: kickoffLabel(match.startedAt ?? match.createdAt),
      detail: series
        ? seriesContextLabel({
            kind: series.kind,
            slotKey: series.slotKey,
            bestOf: series.bestOf,
            gameNumber: match.gameNumber,
          })
        : "Recorded map",
    });
    if (completed.length === 4) break;
  }

  const seasonNote = !liveSeason
    ? "No live season"
    : liveSeason.status === SEASON_STATUS.archived ||
        liveSeason.phase === SEASON_PHASE.COMPLETED
      ? "Complete"
      : liveSeason.status === SEASON_STATUS.upcoming
        ? "Coming up"
        : "Live";

  return {
    activeTournaments,
    registeredTeams,
    completedMatches: recordedMaps + playedLobbies,
    currentSeason: liveSeason ? liveSeasonLabel(liveSeason) : "None",
    currentSeasonNote: seasonNote,
    live: liveFixtures.map((fixture) => ({
      id: fixture.id,
      href: "/schedule",
      game: gameLabel(fixture.season?.game),
      status: "live" as const,
      left: teamName(fixture.radiantTeam.name),
      right: teamName(fixture.direTeam.name),
      score:
        fixture.radiantWins + fixture.direWins > 0
          ? `${fixture.radiantWins}–${fixture.direWins}`
          : null,
      when: kickoffLabel(fixture.scheduledAt),
      detail: seriesContextLabel({
        kind: fixture.kind,
        slotKey: fixture.slotKey,
        bestOf: fixture.bestOf,
      }),
    })),
    upcoming: upcomingFixtures.map((fixture) => ({
      id: fixture.id,
      href: "/schedule",
      game: gameLabel(fixture.season?.game),
      status: "upcoming" as const,
      left: teamName(fixture.radiantTeam.name),
      right: teamName(fixture.direTeam.name),
      score: null,
      when: kickoffLabel(fixture.scheduledAt),
      detail: seriesContextLabel({
        kind: fixture.kind,
        slotKey: fixture.slotKey,
        bestOf: fixture.bestOf,
      }),
    })),
    completed,
  };
}
