import Link from "next/link";
import { MatchTimeZones } from "@/components/match-timezones";
import { weekendSlotLabel } from "@/lib/match-times";
import {
  MATCHES_PER_WEEKEND,
  WINS_FOR_WEEKEND_CROWN,
  formatScheduleWhen,
} from "@/lib/schedule";

type Fixture = {
  id: string;
  slotIndex: number;
  status: string;
  scheduledAt: Date;
  radiantTeam: { id: string; name: string };
  direTeam: { id: string; name: string };
  match?: { winnerTeam?: { id: string; name: string } | null } | null;
};

export function WeekendScheduleBlock({
  weekendIndex,
  fixtures,
  champion,
}: {
  weekendIndex: number;
  fixtures: Fixture[];
  champion: { id: string; name: string; count: number } | null;
}) {
  const completed = fixtures.filter((f) => f.status === "completed").length;
  const nextFixture = fixtures.find((f) => f.status === "scheduled");

  return (
    <section className="weekend-schedule">
      <div className="section-head row">
        <h2>Weekend {weekendIndex + 1}</h2>
        <span className="muted">
          {completed}/{MATCHES_PER_WEEKEND} played · max 2 games per team
        </span>
      </div>
      <p className="weekend-rule muted">
        Three matches Fri / Sat / Sun. First team to <strong>{WINS_FOR_WEEKEND_CROWN}</strong>{" "}
        wins in the weekend takes the crown.
      </p>

      <div className="weekend-grid">
        {fixtures.map((fixture) => {
          const winner = fixture.match?.winnerTeam?.name;
          const isNext = nextFixture?.id === fixture.id;
          return (
            <article
              key={fixture.id}
              className={isNext ? "weekend-card weekend-card-next" : "weekend-card"}
            >
              <div className="weekend-card-head">
                <span className="weekend-day">{weekendSlotLabel(fixture.slotIndex)}</span>
                <span className="weekend-pkt">{formatScheduleWhen(fixture.scheduledAt)}</span>
              </div>
              <p className="weekend-matchup">
                <Link href={`/teams/${fixture.radiantTeam.id}`}>
                  {fixture.radiantTeam.name}
                </Link>
                <span className="muted"> vs </span>
                <Link href={`/teams/${fixture.direTeam.id}`}>
                  {fixture.direTeam.name}
                </Link>
              </p>
              {winner ? (
                <p className="weekend-result gold">{winner} won</p>
              ) : isNext ? (
                <p className="weekend-result muted">Up next</p>
              ) : (
                <p className="weekend-result muted">Scheduled</p>
              )}
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

      {champion ? (
        <p className="weekend-champion">
          Weekend champion: <strong>{champion.name}</strong> ({champion.count} wins)
        </p>
      ) : null}
    </section>
  );
}
