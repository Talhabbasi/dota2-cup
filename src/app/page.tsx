import Link from "next/link";
import { Suspense } from "react";
import { MatchCard } from "@/components/match-card";
import { EsportsCard } from "@/components/common";
import { HomeHero } from "@/components/home-hero";
import { LoginErrorBanner } from "@/components/login-error-banner";
import { WeekendScheduleBlock } from "@/components/weekend-schedule";
import { StandingsBoard } from "@/components/standings-board";
import {
  getStandings,
  getRecentMatches,
  getTeamCount,
  getMatchCount,
  getUpcomingFixture,
} from "@/lib/data";
import { PlayoffGraphLazy } from "@/components/playoff-graph-lazy";
import { getPlayoffView } from "@/lib/playoff";
import { getActiveWeekendBundle } from "@/lib/schedule";
import { getCurrentSeasonChampion, getCurrentSeasonSafe, getLiveSeason, listPublicSeasons } from "@/lib/seasons";
import { SEASON_STATUS } from "@/lib/season-constants";
import { seasonFormatCards } from "@/lib/season-public-copy";
import { toIso } from "@/lib/format";

export const revalidate = 30;

function HomeGroupColumn({
  title,
  teams,
}: {
  title: string;
  teams: { id: string; name: string }[];
}) {
  return (
    <div className="home-group-col">
      <h3>{title}</h3>
      {teams.length === 0 ? (
        <p className="muted">Not assigned yet.</p>
      ) : (
        <ul>
          {teams.map((team) => (
            <li key={team.id}>
              <Link href={`/teams/${team.id}`}>{team.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function Home() {
  const [
    table,
    matches,
    teamCount,
    matchCount,
    upcoming,
    weekend,
    playoff,
    season,
    champion,
    live,
    publicSeasons,
  ] = await Promise.all([
    getStandings(),
    getRecentMatches(5),
    getTeamCount(),
    getMatchCount(),
    getUpcomingFixture(),
    getActiveWeekendBundle(),
    getPlayoffView(),
    getCurrentSeasonSafe(),
    getCurrentSeasonChampion(),
    getLiveSeason(),
    listPublicSeasons(),
  ]);

  const latest = matches[0] ?? null;
  const recent = latest ? matches.slice(1, 5) : matches.slice(0, 4);
  const crowned = Boolean(live && champion);
  const siteMode = crowned ? "champion" : live ? "active" : "upcoming";
  const plannedSeason =
    live ??
    publicSeasons.find(
      (row) =>
        row.status === SEASON_STATUS.upcoming ||
        row.phase === "UPCOMING" ||
        row.phase === "AUCTION_ACTIVE",
    ) ??
    null;
  const seasonPlan = plannedSeason
    ? {
        number: plannedSeason.number,
        name: plannedSeason.name,
        teamCount: plannedSeason.teamCount,
        plannedStartAt: plannedSeason.plannedStartAt
          ? toIso(plannedSeason.plannedStartAt)
          : null,
        startedAt: plannedSeason.startedAt
          ? toIso(plannedSeason.startedAt)
          : null,
        phase: plannedSeason.phase,
        tournamentFormat: plannedSeason.tournamentFormat,
      }
    : null;

  return (
    <>
      <HomeHero
        upcoming={siteMode === "active" ? upcoming : null}
        teamCount={teamCount}
        matchCount={matchCount}
        seasonLabel={season ? `Season ${season.number}` : null}
        seasonPlan={seasonPlan}
        champion={crowned ? champion : null}
        siteMode={siteMode}
      />

      <div className="page home-body">
        <Suspense>
          <LoginErrorBanner />
        </Suspense>

        {siteMode === "upcoming" ? (
          <section className="mb-8" aria-label="Between seasons">
            <EsportsCard className="px-5 py-6 sm:px-7">
              <p className="m-0 text-sm text-muted-foreground">
                No live tournament right now. Browse the{" "}
                <Link href="/seasons" className="text-link">
                  season archive
                </Link>{" "}
                for champions, brackets, and match history.
              </p>
            </EsportsCard>
          </section>
        ) : crowned && champion ? (
          <section className="mb-8" aria-label="Season champion">
            <EsportsCard className="overflow-hidden px-5 py-6 sm:px-7">
              <p className="m-0 font-mono text-sm font-bold tracking-[0.18em] text-amber-500 uppercase">
                Season {champion.seasonNumber} champions
              </p>
              <h2 className="mt-2 mb-2 font-display text-3xl tracking-wide text-foreground uppercase sm:text-4xl">
                <Link href={`/teams/${champion.team.id}`}>
                  {champion.team.name}
                </Link>
              </h2>
              <p className="m-0 mb-4 text-sm text-muted-foreground">
                Tournament ended
                {champion.finalScore
                  ? ` · Grand Final ${champion.finalScore}`
                  : ""}
                . Bracket and match history stay up for the archive.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/playoffs" className="btn btn-gold">
                  View bracket
                </Link>
                <Link href="/matches" className="btn">
                  All matches
                </Link>
                <Link href="/seasons" className="btn btn-ghost">
                  Seasons
                </Link>
              </div>
            </EsportsCard>
          </section>
        ) : (
          <section
            className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Cup format"
          >
            {seasonFormatCards(seasonPlan?.teamCount ?? 8).map((card) => (
              <EsportsCard key={card.index} className="px-5 py-5">
                <p className="m-0 font-mono text-lg font-bold text-amber-500">
                  {card.index}
                </p>
                <h2 className="mt-2 mb-1.5 font-display text-lg tracking-wide text-foreground uppercase">
                  {card.title}
                </h2>
                <p className="m-0 text-sm leading-relaxed text-muted-foreground">
                  {card.copy}
                </p>
              </EsportsCard>
            ))}
          </section>
        )}

        {siteMode === "active" && latest ? (
          <section className="mb-8">
            <MatchCard match={latest} showDate kicker="Latest match" />
          </section>
        ) : null}

        {siteMode === "active" &&
        playoff.groupA.length + playoff.groupB.length > 0 ? (
          <section className="home-playoff-link">
            <div className="weekend-board home-groups-board">
              <div className="section-head row">
                <h2>Group stage</h2>
                <Link href="/playoffs" className="text-link">
                  Full bracket
                </Link>
              </div>
              <div className="home-groups-grid">
                <HomeGroupColumn title="Group A" teams={playoff.groupA} />
                <HomeGroupColumn title="Group B" teams={playoff.groupB} />
              </div>
              <PlayoffGraphLazy view={playoff} compact />
            </div>
          </section>
        ) : null}

        {siteMode === "active" && weekend ? (
          <WeekendScheduleBlock
            weekendIndex={weekend.weekendIndex}
            fixtures={weekend.fixtures}
          />
        ) : null}

        {siteMode === "active" && table.length > 0 ? (
          <section className="home-standings">
            <div className="section-head row">
              <h2>Standings</h2>
              <Link href="/table" className="text-link">
                Full table
              </Link>
            </div>
            <StandingsBoard
              compact
              limit={5}
              rows={table.map((row) => ({
                id: row.id,
                name: row.name,
                played: row.played,
                wins: row.wins,
                losses: row.losses,
                points: row.points,
              }))}
            />
          </section>
        ) : null}

        {siteMode === "active" && recent.length > 0 ? (
          <section className="home-recent">
            <div className="section-head row">
              <h2>Recent matches</h2>
              <Link href="/matches" className="text-link">
                View all
              </Link>
            </div>
            <div className="vs-stack">
              {recent.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
