import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { publicFixtureWhere, publicTeamWhere } from "./dummy";
import {
  getUpcomingFixture,
  type FixturePreview,
} from "./data";
import { getPublicPlayerInsight } from "./player-insight";
import { teamFeePkr } from "./registration-status";
import {
  SEASON_PHASE,
  SEASON_STATUS,
  tournamentFormatLabel,
} from "./season-constants";
import {
  getLiveSeason,
  getSeasonHistory,
  listPublicSeasons,
} from "./seasons";
import { toIso } from "./format";
import { PUBLIC_PAGE_TAG, PUBLIC_REVALIDATE_SECONDS } from "./cache-tags";

const FINAL_WHERE = {
  OR: [{ kind: "final" }, { slotKey: "final" }],
};

function seasonDisplayName(number: number, name?: string | null) {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : `Season ${number}`;
}

export type HeroGrandFinalCard = {
  radiant: { id: string; name: string };
  dire: { id: string; name: string };
  radiantWins: number;
  direWins: number;
  winnerTeamId: string | null;
  scoreLabel: string;
};

export type HeroActiveSlide = {
  kind: "active";
  seasonId: string;
  seasonNumber: number;
  seasonName: string;
  phase: string;
  status: string;
  title: string;
  lead: string;
  teamCount: number;
  registeredTeams: number;
  prizePoolLabel: string;
  formatLabel: string;
  countdownIso: string | null;
  countdownLabel: string;
  primaryCta: { href: string; label: string };
  secondaryCta: { href: string; label: string };
  upcoming: {
    radiantTeam: { id: string; name: string };
    direTeam: { id: string; name: string };
    scheduledAt: string | null;
    bestOf: number;
    kind?: string;
    slotKey?: string | null;
  } | null;
};

export type HeroChampionSlide = {
  kind: "champion";
  seasonId: string;
  seasonNumber: number;
  seasonName: string;
  archiveHref: string;
  title: string;
  championTeam: { id: string; name: string };
  mvpPlayer: { id: string; steamName: string } | null;
  finalScore: string | null;
  grandFinal: HeroGrandFinalCard | null;
};

export type HeroBannerSlide = HeroActiveSlide | HeroChampionSlide;

export type HomepageHeroBanner = {
  activeSeason: HeroActiveSlide | null;
  pastChampions: HeroChampionSlide[];
  slides: HeroBannerSlide[];
};

function formatPrizePool(teamCount: number) {
  const total = Math.max(0, teamCount) * teamFeePkr();
  return `Rs ${total.toLocaleString("en-PK")} pool`;
}

function activeTitle(input: {
  number: number;
  phase: string;
  status: string;
  crowned: boolean;
}) {
  if (input.crowned) return `Season ${input.number} Champions`;
  if (input.phase === SEASON_PHASE.AUCTION_ACTIVE) {
    return `Season ${input.number} · Auction Phase`;
  }
  if (
    input.phase === SEASON_PHASE.UPCOMING ||
    input.status === SEASON_STATUS.upcoming
  ) {
    return `Season ${input.number} is Upcoming`;
  }
  return `Season ${input.number} is Live`;
}

function activeLead(input: {
  number: number;
  phase: string;
  formatLabel: string;
  teamCount: number;
  registeredTeams: number;
}) {
  const teams =
    input.registeredTeams > 0
      ? `${input.registeredTeams}/${input.teamCount} franchises`
      : `${input.teamCount} franchises planned`;
  if (input.phase === SEASON_PHASE.AUCTION_ACTIVE) {
    return `Auction desk is open · ${input.formatLabel} · ${teams}.`;
  }
  if (input.phase === SEASON_PHASE.UPCOMING) {
    return `Registration and auction come next · ${input.formatLabel} · ${teams}.`;
  }
  return `Indoor weekend matches · ${input.formatLabel} · ${teams}.`;
}

function serializeUpcoming(upcoming: FixturePreview | null) {
  if (!upcoming) return null;
  return {
    radiantTeam: upcoming.radiantTeam,
    direTeam: upcoming.direTeam,
    scheduledAt: upcoming.scheduledAt ? toIso(upcoming.scheduledAt) : null,
    bestOf: upcoming.bestOf ?? 1,
    kind: upcoming.kind,
    slotKey: upcoming.slotKey ?? null,
  };
}

async function loadGrandFinal(seasonId: string): Promise<{
  card: HeroGrandFinalCard | null;
  finalScore: string | null;
  snapshotScore: string | null;
}> {
  const [fixture, snapshot] = await Promise.all([
    prisma.scheduledFixture.findFirst({
      where: {
        seasonId,
        status: "completed",
        ...FINAL_WHERE,
        ...publicFixtureWhere,
      },
      include: {
        radiantTeam: { select: { id: true, name: true } },
        direTeam: { select: { id: true, name: true } },
        match: { select: { winnerTeamId: true } },
      },
      orderBy: { scheduledAt: "desc" },
    }),
    prisma.seasonSnapshot.findUnique({
      where: { seasonId },
      select: { finalScore: true },
    }),
  ]);

  if (!fixture) {
    return {
      card: null,
      finalScore: snapshot?.finalScore ?? null,
      snapshotScore: snapshot?.finalScore ?? null,
    };
  }

  const winnerTeamId =
    fixture.radiantWins > fixture.direWins
      ? fixture.radiantTeamId
      : fixture.direWins > fixture.radiantWins
        ? fixture.direTeamId
        : fixture.match?.winnerTeamId ?? null;

  const scoreLabel = `${fixture.radiantWins} – ${fixture.direWins}`;
  return {
    card: {
      radiant: fixture.radiantTeam,
      dire: fixture.direTeam,
      radiantWins: fixture.radiantWins,
      direWins: fixture.direWins,
      winnerTeamId,
      scoreLabel,
    },
    finalScore: `${Math.max(fixture.radiantWins, fixture.direWins)}–${Math.min(fixture.radiantWins, fixture.direWins)}`,
    snapshotScore: snapshot?.finalScore ?? null,
  };
}

async function buildChampionSlide(input: {
  id: string;
  number: number;
  name: string;
  champion: { id: string; name: string };
}): Promise<HeroChampionSlide> {
  const [{ card, finalScore, snapshotScore }, insights] = await Promise.all([
    loadGrandFinal(input.id),
    getPublicPlayerInsight({ seasonId: input.id }),
  ]);

  const pot = insights.playerOfTournament;
  return {
    kind: "champion",
    seasonId: input.id,
    seasonNumber: input.number,
    seasonName: seasonDisplayName(input.number, input.name),
    archiveHref: `/seasons/season-${input.number}`,
    title: `Season ${input.number} Champions`,
    championTeam: input.champion,
    mvpPlayer:
      pot?.playerId && pot.name
        ? { id: pot.playerId, steamName: pot.name }
        : null,
    finalScore: finalScore ?? snapshotScore,
    grandFinal: card,
  };
}

async function buildActiveSlide(): Promise<HeroActiveSlide | null> {
  const [live, publicSeasons, upcoming] = await Promise.all([
    getLiveSeason(),
    listPublicSeasons(),
    getUpcomingFixture(),
  ]);

  const planned =
    live ??
    publicSeasons.find(
      (row) =>
        row.status === SEASON_STATUS.upcoming ||
        row.phase === SEASON_PHASE.UPCOMING ||
        row.phase === SEASON_PHASE.AUCTION_ACTIVE,
    ) ??
    null;

  if (!planned) return null;

  const registeredTeams = await prisma.team.count({
    where: { seasonId: planned.id, ...publicTeamWhere },
  });

  const formatLabel = tournamentFormatLabel(planned.tournamentFormat);
  const preTournament =
    planned.phase === SEASON_PHASE.UPCOMING ||
    planned.phase === SEASON_PHASE.AUCTION_ACTIVE ||
    planned.status === SEASON_STATUS.upcoming;
  const crowned =
    Boolean(live && "championTeamId" in live && live.championTeamId) &&
    live?.id === planned.id;

  const countdownIso = upcoming?.scheduledAt
    ? toIso(upcoming.scheduledAt)
    : planned.plannedStartAt
      ? toIso(planned.plannedStartAt)
      : planned.startedAt
        ? toIso(planned.startedAt)
        : null;

  const countdownLabel = upcoming?.scheduledAt
    ? "Next match"
    : planned.phase === SEASON_PHASE.AUCTION_ACTIVE
      ? "Auction"
      : "Starts";

  return {
    kind: "active",
    seasonId: planned.id,
    seasonNumber: planned.number,
    seasonName: seasonDisplayName(planned.number, planned.name),
    phase: planned.phase,
    status: planned.status,
    title: activeTitle({
      number: planned.number,
      phase: planned.phase,
      status: planned.status,
      crowned,
    }),
    lead: activeLead({
      number: planned.number,
      phase: planned.phase,
      formatLabel,
      teamCount: planned.teamCount,
      registeredTeams,
    }),
    teamCount: planned.teamCount,
    registeredTeams,
    prizePoolLabel: formatPrizePool(planned.teamCount),
    formatLabel,
    countdownIso,
    countdownLabel,
    primaryCta: preTournament
      ? { href: "/register", label: "Register" }
      : { href: "/playoffs", label: "View Live Bracket" },
    secondaryCta: { href: "/predictions", label: "Predictions" },
    upcoming: serializeUpcoming(upcoming),
  };
}

async function loadHomepageHeroBanner(): Promise<HomepageHeroBanner> {
  const [activeSeason, history] = await Promise.all([
    buildActiveSlide(),
    getSeasonHistory(),
  ]);

  const liveId = activeSeason?.seasonId ?? null;
  const champCandidates = history.filter(
    (row) =>
      row.champion &&
      row.id !== liveId &&
      (row.status === SEASON_STATUS.archived ||
        Boolean(row.endedAt) ||
        row.number < (activeSeason?.seasonNumber ?? Number.POSITIVE_INFINITY)),
  );

  const pastChampions = await Promise.all(
    champCandidates
      .filter((row): row is typeof row & { champion: NonNullable<typeof row.champion> } =>
        Boolean(row.champion),
      )
      .map((row) =>
        buildChampionSlide({
          id: row.id,
          number: row.number,
          name: row.name,
          champion: { id: row.champion.id, name: row.champion.name },
        }),
      ),
  );

  const slides: HeroBannerSlide[] = [
    ...(activeSeason ? [activeSeason] : []),
    ...pastChampions,
  ];

  return { activeSeason, pastChampions, slides };
}

export const getHomepageHeroBanner = unstable_cache(
  loadHomepageHeroBanner,
  ["homepage-hero-banner"],
  {
    tags: [PUBLIC_PAGE_TAG],
    revalidate: PUBLIC_REVALIDATE_SECONDS,
  },
);
