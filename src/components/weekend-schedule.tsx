import Link from "next/link";
import { Clock3 } from "lucide-react";
import { MatchTimeZones } from "@/components/match-timezones";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { KICKOFF_SHORT } from "@/lib/play-window";
import { weekendSlotLabel } from "@/lib/match-times";
import { isPlayoffKind, playoffRoundLabel } from "@/lib/playoff";
import { formatScheduleWhen, scheduleUtcOffsetHours, asDate } from "@/lib/schedule";
import { cn } from "@/lib/utils";

type Fixture = {
  id: string;
  slotIndex: number;
  status: string;
  scheduledAt: Date | string;
  kind?: string;
  slotKey?: string | null;
  bestOf?: number;
  radiantWins?: number;
  direWins?: number;
  radiantTeam: { id: string; name: string };
  direTeam: { id: string; name: string };
  match?: { winnerTeam?: { id: string; name: string } | null } | null;
};

function nightWindowLabel(date: Date | string): string | null {
  const offsetH = scheduleUtcOffsetHours();
  const shifted = new Date(asDate(date).getTime() + offsetH * 3_600_000);
  const hour = shifted.getUTCHours();
  // Group-stage late slot is after midnight; evening is 8pm–midnight.
  // Daytime playoff kickoffs skip this badge — PKT time is already on the card.
  if (hour < 8) return KICKOFF_SHORT.late;
  if (hour >= 20) return KICKOFF_SHORT.evening;
  return null;
}

function statusBadge(fixture: Fixture, isNext: boolean) {
  const winner = fixture.match?.winnerTeam?.name;
  if (winner && fixture.status === "completed") {
    return (
      <Badge className="h-5 border-emerald-500/30 bg-emerald-500/15 px-2 text-[0.62rem] tracking-[0.12em] text-emerald-300 uppercase">
        Final
      </Badge>
    );
  }
  if (isNext) {
    return (
      <Badge className="h-5 border-amber-500/40 bg-amber-500/15 px-2 text-[0.62rem] tracking-[0.12em] text-amber-300 uppercase">
        Upcoming
      </Badge>
    );
  }
  if (fixture.status === "scheduled") {
    return (
      <Badge
        variant="outline"
        className="h-5 border-white/15 bg-transparent px-2 text-[0.62rem] tracking-[0.12em] text-zinc-400 uppercase"
      >
        Upcoming
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="h-5 border-white/15 bg-transparent px-2 text-[0.62rem] tracking-[0.12em] text-zinc-400 uppercase"
    >
      Scheduled
    </Badge>
  );
}

export function WeekendScheduleBlock({
  weekendIndex,
  fixtures,
}: {
  weekendIndex: number;
  fixtures: Fixture[];
}) {
  const nextFixture = fixtures.find((f) => f.status === "scheduled");
  const isFinal = fixtures.some((f) => f.kind === "final");
  const isPlayoff = fixtures.some((f) => isPlayoffKind(f.kind));

  return (
    <section className="mb-8">
      <div className="rounded-2xl border border-white/10 bg-[#121824] p-5 sm:p-6">
        <div className="mb-2 flex items-baseline justify-between gap-4">
          <h2 className="m-0 font-display text-xl tracking-wide text-foreground">
            {isFinal
              ? "Grand Final"
              : isPlayoff
                ? "This weekend"
                : `Weekend ${weekendIndex + 1}`}
          </h2>
          <Link href="/schedule" className="text-link">
            Full schedule
          </Link>
        </div>
        <p className="mt-0 mb-5 text-sm text-muted-foreground">
          {isFinal
            ? "Upper Final winner vs Lower Final winner. Bo3, first to 2."
            : isPlayoff
              ? "Saturday and Sunday only. Group stage 10:00 PM–6:00 AM PKT; playoffs 10:00 AM–3:00 AM PKT."
              : "Saturday and Sunday only. Kickoff slots are 10:00 PM through 6:00 AM PKT."}
        </p>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {fixtures.map((fixture) => {
            const winner = fixture.match?.winnerTeam?.name;
            const isNext = nextFixture?.id === fixture.id;
            const bestOf = fixture.bestOf ?? 1;
            const windowLabel = nightWindowLabel(fixture.scheduledAt);
            const roundLabel = isPlayoffKind(fixture.kind)
              ? playoffRoundLabel(fixture.kind, fixture.slotKey)
              : weekendSlotLabel(fixture.slotIndex);

            return (
              <Card
                key={fixture.id}
                className={cn(
                  "gap-0 border border-white/10 bg-[#0a0d14]/55 py-0 text-foreground shadow-none ring-0 transition-all duration-200 hover:border-amber-500/40 hover:bg-[#161f30]",
                  isNext && "border-amber-500/50 bg-amber-500/5",
                )}
              >
                <CardContent className="grid gap-3 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {statusBadge(fixture, isNext)}
                    {windowLabel ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-5 border-white/15 bg-transparent px-2 text-[0.62rem] tracking-[0.12em] uppercase",
                          windowLabel === "After 12am"
                            ? "border-red-500/30 text-red-300"
                            : "text-zinc-400",
                        )}
                      >
                        {windowLabel}
                      </Badge>
                    ) : null}
                    <Badge
                      variant="outline"
                      className="h-5 border-white/15 bg-transparent px-2 text-[0.62rem] tracking-[0.12em] text-zinc-400 uppercase"
                    >
                      {bestOf > 1
                        ? `Bo${bestOf} ${fixture.radiantWins ?? 0}–${fixture.direWins ?? 0}`
                        : `Bo${bestOf}`}
                    </Badge>
                  </div>

                  <p className="m-0 text-[0.65rem] font-semibold tracking-[0.14em] text-amber-400 uppercase">
                    {roundLabel}
                  </p>

                  <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-base font-semibold tracking-wide">
                    <Link
                      href={`/teams/${fixture.radiantTeam.id}`}
                      className="text-white! transition-colors hover:text-amber-300!"
                    >
                      {fixture.radiantTeam.name}
                    </Link>
                    <span className="text-[0.65rem] tracking-[0.16em] text-slate-500 uppercase">
                      vs
                    </span>
                    <Link
                      href={`/teams/${fixture.direTeam.id}`}
                      className="text-white! transition-colors hover:text-amber-300!"
                    >
                      {fixture.direTeam.name}
                    </Link>
                  </p>

                  <p className="m-0 inline-flex items-center gap-2 font-mono text-sm font-semibold tracking-wide text-zinc-200 tabular-nums">
                    <Clock3 className="size-3.5 shrink-0 text-amber-400" aria-hidden />
                    {formatScheduleWhen(fixture.scheduledAt)}
                  </p>

                  {winner && fixture.status === "completed" ? (
                    <p className="m-0 text-sm text-amber-400">{winner} won</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {nextFixture ? (
          <div className="mt-5 rounded-xl border border-white/10 bg-[#0a0d14]/55 p-4 sm:p-5">
            <p className="m-0 mb-3 text-[0.65rem] font-semibold tracking-[0.16em] text-amber-400 uppercase">
              Kickoff times — next match
            </p>
            <MatchTimeZones at={nextFixture.scheduledAt} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
