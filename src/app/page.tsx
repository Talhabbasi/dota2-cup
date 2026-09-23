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

  return (
    <>
      <HomeHero
        upcoming={upcoming}
        teamCount={teamCount}
        matchCount={matchCount}
        seasonLabel={season ? `Season ${season.number}` : null}
      />

      <div className="page home-body">
        <Suspense>
          <LoginErrorBanner />
        </Suspense>

        <section
          className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Cup format"
        >
          {[
            ["01", "Group stage", "Two groups of four. Round-robin Bo1. Fourth place is out."],
            ["02", "Crossovers", "A1 vs B2 and B1 vs A2. Each 3rd waits for a loser."],
            ["03", "Playoffs", "Double-elim graph. Grand Final is Bo3. Everything else Bo1."],
          ].map(([index, title, copy]) => (
            <EsportsCard key={index} className="px-5 py-5">
              <p className="m-0 font-mono text-lg font-bold text-amber-500">{index}</p>
              <h2 className="mt-2 mb-1.5 font-display text-lg tracking-wide text-foreground uppercase">
                {title}
              </h2>
              <p className="m-0 text-sm leading-relaxed text-muted-foreground">{copy}</p>
            </EsportsCard>
          ))}
        </section>

        {latest ? (
          <section className="mb-8">
            <MatchCard match={latest} showDate kicker="Latest match" />
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
              <PlayoffGraphLazy view={playoff} compact />
            </div>
          </section>
        ) : null}

        {weekend ? (
          <WeekendScheduleBlock
            weekendIndex={weekend.weekendIndex}
            fixtures={weekend.fixtures}
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
