import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { MatchCard } from "@/components/match-card";
import {
  LatestMatchSpotlight,
  UpcomingMatchSpotlight,
} from "@/components/home-spotlight";
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
import { getPlayoffView } from "@/lib/playoff";
import { getActiveWeekendBundle } from "@/lib/schedule";

export const revalidate = 30;

export default async function Home() {
  const [table, matches, teamCount, matchCount, upcoming, weekend, playoff] =
    await Promise.all([
      getStandings(),
      getRecentMatches(5),
      getTeamCount(),
      getMatchCount(),
      getUpcomingFixture(),
      getActiveWeekendBundle(),
      getPlayoffView(),
    ]);

  const latest = matches[0] ?? null;
  const recent = latest ? matches.slice(1, 5) : matches.slice(0, 4);
  const showSpotlight = Boolean(latest || upcoming);

  return (
    <>
      <section className="hero-bleed hero-bleed-compact hero-bleed-dota">
        <div className="hero-bleed-shade" />
        <div className="hero-bleed-content">
          <p className="brand-hero animate-rise">
            <Image
              src="/mm-dota-cup-icon.png"
              alt=""
              width={72}
              height={72}
              className="brand-hero-icon"
              priority
            />
            MM Dota Cup
          </p>
        </div>
      </section>

      <div className="page home-body">
        <Suspense>
          <LoginErrorBanner />
        </Suspense>
        <div className="home-stats">
          <div className="home-stat">
            <span className="home-stat-label">Teams registered</span>
            <strong>{teamCount}</strong>
          </div>
          <div className="home-stat">
            <span className="home-stat-label">Matches played</span>
            <strong>{matchCount}</strong>
          </div>
        </div>

        {showSpotlight ? (
          <section className="home-spotlight">
            {latest ? <LatestMatchSpotlight match={latest} /> : null}
            {upcoming ? (
              <UpcomingMatchSpotlight fixture={upcoming} />
            ) : null}
          </section>
        ) : null}

        {playoff.groupA.length + playoff.groupB.length > 0 ? (
          <section className="home-playoff-link">
            <div className="section-head row">
              <h2>Playoffs</h2>
              <Link href="/playoffs" className="text-link">
                Groups
              </Link>
            </div>
            <p className="muted">
              Group A · {playoff.groupA.map((team) => team.name).join(", ") || "empty"}
              <br />
              Group B · {playoff.groupB.map((team) => team.name).join(", ") || "empty"}
            </p>
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
