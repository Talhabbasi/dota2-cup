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
import { PlayoffGraph } from "@/components/playoff-graph";
import { getPlayoffView } from "@/lib/playoff";
import { getActiveWeekendBundle } from "@/lib/schedule";

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
          <section
            className={
              latest && upcoming
                ? "home-spotlight"
                : "home-spotlight home-spotlight-solo"
            }
          >
            {latest ? <LatestMatchSpotlight match={latest} /> : null}
            {upcoming ? (
              <UpcomingMatchSpotlight fixture={upcoming} />
            ) : null}
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
