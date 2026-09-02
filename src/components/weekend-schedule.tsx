import Link from "next/link";
import { MatchTimeZones } from "@/components/match-timezones";
import { PLAY_WINDOW_SHORT } from "@/lib/play-window";
import { weekendSlotLabel } from "@/lib/match-times";
import { MATCHES_PER_WEEKEND, formatScheduleWhen, kickoffWindowFromDate } from "@/lib/schedule";

type Fixture = {
  id: string;
  slotIndex: number;
  status: string;
  scheduledAt: Date;
  kind?: string;
  bestOf?: number;
  radiantWins?: number;
  direWins?: number;
  radiantTeam: { id: string; name: string };
  direTeam: { id: string; name: string };
  match?: { winnerTeam?: { id: string; name: string } | null } | null;
};

export function WeekendScheduleBlock({
  weekendIndex,
  fixtures,
}: {
  weekendIndex: number;
  fixtures: Fixture[];
  champion?: { id: string; name: string; count: number } | null;
}) {
  const completed = fixtures.filter((f) => f.status === "completed").length;
  const nextFixture = fixtures.find((f) => f.status === "scheduled");
  const isFinal = fixtures.some((f) => f.kind === "final");

  return (
    <section className="weekend-schedule">
      <div className="weekend-board">
        <div className="section-head row">
          <h2>{isFinal ? "Grand Final" : `Weekend ${weekendIndex + 1}`}</h2>
          <span className="muted">
            {isFinal
              ? "Best of 3 · first to 2"
              : `${completed}/${MATCHES_PER_WEEKEND} played · best of 1`}
          </span>
        </div>
        <p className="weekend-rule muted">
          {isFinal
            ? "Top 2 from the table play a best of 3. Regular season games stay best of 1."
            : "Three best-of-1 matches Fri / Sat / Sun. Kickoff is 11:30 PM PKT for the evening window, or 12:30 AM for after-midnight teams. The top 2 meet in a best-of-3 final."}
        </p>

        <div className="weekend-grid">
          {fixtures.map((fixture) => {
            const winner = fixture.match?.winnerTeam?.name;
            const isNext = nextFixture?.id === fixture.id;
            const bestOf = fixture.bestOf ?? 1;
            return (
              <article
                key={fixture.id}
                className={isNext ? "weekend-card weekend-card-next" : "weekend-card"}
              >
                <div className="weekend-card-head">
                  <span className="weekend-day">
                    {fixture.kind === "final"
                      ? "Final"
                      : weekendSlotLabel(fixture.slotIndex)}
                    {" · "}
                    {PLAY_WINDOW_SHORT[kickoffWindowFromDate(fixture.scheduledAt)]}
                  </span>
                  {winner && fixture.status === "completed" ? (
                    <span className="weekend-status weekend-status-won">Won</span>
                  ) : isNext ? (
                    <span className="weekend-status weekend-status-next">Up next</span>
                  ) : (
                    <span className="weekend-status">
                      {bestOf > 1
                        ? `BO${bestOf} ${fixture.radiantWins ?? 0}–${fixture.direWins ?? 0}`
                        : "BO1"}
                    </span>
                  )}
                </div>
                <p className="weekend-matchup">
                  <Link
                    className="weekend-team"
                    href={`/teams/${fixture.radiantTeam.id}`}
                  >
                    {fixture.radiantTeam.name}
                  </Link>
                  <span className="weekend-vs">vs</span>
                  <Link className="weekend-team" href={`/teams/${fixture.direTeam.id}`}>
                    {fixture.direTeam.name}
                  </Link>
                </p>
                <p className="weekend-pkt">{formatScheduleWhen(fixture.scheduledAt)}</p>
                {winner && fixture.status === "completed" ? (
                  <p className="weekend-result gold">{winner} won</p>
                ) : null}
              </article>
            );
          })}
        </div>

        {nextFixture ? (
          <div className="weekend-times-panel">
            <p className="eyebrow">Kickoff times — next match</p>
            <MatchTimeZones at={nextFixture.scheduledAt} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
