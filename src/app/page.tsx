import Link from "next/link";
import { Suspense } from "react";
import { MatchCard } from "@/components/match-card";
import { LatestMatchSpotlight } from "@/components/home-spotlight";
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
import { PlayoffGraph } from "@/components/playoff-graph";
import { getPlayoffView } from "@/lib/playoff";
import { getActiveWeekendBundle } from "@/lib/schedule";
import { getCurrentSeasonSafe } from "@/lib/seasons";

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
  const [table, matches, teamCount, matchCount, upcoming, weekend, playoff, season] =
    await Promise.all([
      getStandings(),
      getRecentMatches(5),
      getTeamCount(),
      getMatchCount(),
      getUpcomingFixture(),
      getActiveWeekendBundle(),
      getPlayoffView(),
      getCurrentSeasonSafe(),
    ]);

  const latest = matches[0] ?? null;
  const recent = latest ? matches.slice(1, 5) : matches.slice(0, 4);
  const marquee = [...playoff.groupA, ...playoff.groupB].map((team) => team.name);

  return (
    <>
      <HomeHero
        upcoming={upcoming}
        teamCount={teamCount}
        matchCount={matchCount}
        marquee={marquee}
        seasonLabel={season ? `Season ${season.number}` : null}
      />

      <div className="page home-body">
        <Suspense>
          <LoginErrorBanner />
        </Suspense>

        <section className="format-strip" aria-label="Cup format">
          <article>
            <span>01</span>
            <h2>Group stage</h2>
            <p>Two groups of four. Round-robin Bo1. Fourth place is out.</p>
          </article>
          <article>
            <span>02</span>
            <h2>Advancement</h2>
            <p>A3 vs B3 in a single match. Winner keeps the run alive.</p>
          </article>
          <article>
            <span>03</span>
            <h2>Playoffs</h2>
            <p>Double-elim graph. Grand Final is Bo3. Everything else Bo1.</p>
          </article>
        </section>

        {latest ? (
          <section className="home-spotlight home-spotlight-solo">
            <LatestMatchSpotlight match={latest} />
          </section>
        ) : null}

        {playoff.groupA.length + playoff.groupB.length > 0 ? (
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
              <PlayoffGraph view={playoff} compact />
            </div>
          </section>
        ) : null}

        {weekend ? (
          <WeekendScheduleBlock
            weekendIndex={weekend.weekendIndex}
            fixtures={weekend.fixtures}
            champion={weekend.champion}
          />
        ) : null}

        {table.length > 0 ? (
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

        {recent.length > 0 ? (
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
