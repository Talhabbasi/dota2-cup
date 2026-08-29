import Image from "next/image";
import Link from "next/link";
import { MatchCard } from "@/components/match-card";
import {
  LatestMatchSpotlight,
  UpcomingMatchSpotlight,
} from "@/components/home-spotlight";
import { WeekendScheduleBlock } from "@/components/weekend-schedule";
import { StandingsBoard } from "@/components/standings-board";
import {
  getStandings,
  getMatches,
  getTeams,
  getUpcomingFixture,
} from "@/lib/data";
import { getActiveWeekendBundle } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [table, matches, teams, upcoming, weekend] = await Promise.all([
    getStandings(),
    getMatches(),
    getTeams(),
    getUpcomingFixture(),
    getActiveWeekendBundle(),
  ]);

  const latest = matches[0] ?? null;
  const recent = latest ? matches.slice(1, 5) : matches.slice(0, 4);

  return (
    <>
      <section className="hero-bleed hero-bleed-compact">
        <Image
          src="/brand/hero-trophy.png"
          alt="MM Dota Cup"
          fill
          priority
          className="hero-bleed-image"
          sizes="100vw"
        />
        <div className="hero-bleed-shade" />
        <div className="hero-bleed-content">
          <p className="brand-hero animate-rise">MM Dota Cup</p>
          <h1 className="animate-rise delay-1">Draft. Play. Dominate.</h1>
        </div>
      </section>

      <div className="page home-body">
        {error === "discord" || error === "OAuthCallback" ? (
          <p className="lede" role="alert">
            Discord login failed. Check the OAuth2 Client Secret and redirect URL,
            then try Sign in again.
          </p>
        ) : null}
        <div className="home-stats">
          <div className="home-stat">
            <span className="home-stat-label">Teams registered</span>
            <strong>{teams.length}</strong>
          </div>
          <div className="home-stat">
            <span className="home-stat-label">Matches played</span>
            <strong>{matches.length}</strong>
          </div>
          <div className="home-stat">
            <span className="home-stat-label">Leader</span>
            <strong>{table[0]?.name ?? "—"}</strong>
          </div>
        </div>

        <section className="home-spotlight">
          {latest ? (
            <LatestMatchSpotlight match={latest} />
          ) : (
            <div className="spotlight-card spotlight-latest spotlight-placeholder">
              <div className="spotlight-head">
                <span className="spotlight-badge">Latest match</span>
              </div>
              <div className="spotlight-empty">
                <p>No matches posted yet. Results appear here after the first game.</p>
              </div>
            </div>
          )}
          <UpcomingMatchSpotlight fixture={upcoming} teamCount={teams.length} />
        </section>

        {weekend ? (
          <WeekendScheduleBlock
            weekendIndex={weekend.weekendIndex}
            fixtures={weekend.fixtures}
            champion={weekend.champion}
          />
        ) : null}

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

        <section className="home-recent">
          <div className="section-head row">
            <h2>Recent matches</h2>
            <Link href="/matches" className="text-link">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="empty-panel">
              <p className="muted">More matches will show up here after they are posted.</p>
            </div>
          ) : (
            <div className="vs-stack">
              {recent.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
