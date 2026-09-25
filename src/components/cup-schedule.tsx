"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  EsportsCard,
  MatchStatusBadge,
  type MatchStatus,
  TeamBadge,
} from "@/components/common";
import { MatchTimeZones } from "@/components/match-timezones";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isPlayoffKind, playoffRoundLabel } from "@/lib/playoff";
import { formatScheduleWhen, scheduleUtcOffsetHours } from "@/lib/schedule";
import {
  groupScheduleByNight,
  type ScheduleFixtureView,
} from "@/lib/schedule-crud";
import { cn } from "@/lib/utils";

function formatPktClock(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const offsetH = scheduleUtcOffsetHours();
  const shifted = new Date(d.getTime() + offsetH * 3_600_000);
  const hour = shifted.getUTCHours();
  const minute = shifted.getUTCMinutes();
  const ampm = hour >= 12 ? "PM" : "AM";
  const hr = hour % 12 || 12;
  const min = minute.toString().padStart(2, "0");
  return `${hr}:${min} ${ampm} PKT`;
}

function fixtureMatchStatus(
  fixture: ScheduleFixtureView,
  now: number,
): MatchStatus {
  if (fixture.status === "completed") return "completed";
  const at = new Date(fixture.scheduledAt).getTime();
  const bestOf = fixture.bestOf ?? 1;
  const durationMs = (bestOf >= 3 ? 4 : 2) * 60 * 60 * 1000;
  if (now >= at && now < at + durationMs) return "live";
  return "upcoming";
}

function FixtureCard({
  fixture,
  isNext,
  now,
}: {
  fixture: ScheduleFixtureView;
  isNext: boolean;
  now: number;
}) {
  const status = fixtureMatchStatus(fixture, now);
  const bestOf = fixture.bestOf ?? 1;
  const winner = fixture.match?.winnerTeam?.name;
  const roundLabel = isPlayoffKind(fixture.kind)
    ? playoffRoundLabel(fixture.kind, fixture.slotKey)
    : fixture.kind === "group"
      ? "Group stage"
      : formatScheduleWhen(fixture.scheduledAt);

  return (
    <EsportsCard
      className={cn(
        "overflow-hidden",
        isNext && "border-amber-500/40 ring-1 ring-amber-500/20",
      )}
    >
      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
        <div className="flex shrink-0 flex-col gap-1 sm:w-28">
          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {formatPktClock(fixture.scheduledAt)}
          </span>
          <span className="text-[0.65rem] tracking-[0.12em] text-muted-foreground uppercase">
            {roundLabel}
          </span>
        </div>

        <Badge
          variant="outline"
          className="h-5 w-fit shrink-0 border-white/15 bg-transparent px-2 text-[0.62rem] tracking-[0.12em] text-zinc-300 uppercase"
        >
          Bo{bestOf}
          {bestOf > 1 && fixture.status !== "completed"
            ? ` · ${fixture.radiantWins ?? 0}–${fixture.direWins ?? 0}`
            : ""}
        </Badge>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
          <Link
            href={`/teams/${fixture.radiantTeam.id}`}
            className="min-w-0 text-foreground!"
          >
            <TeamBadge name={fixture.radiantTeam.name} side="radiant" size="sm" />
          </Link>
          <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            vs
          </span>
          <Link
            href={`/teams/${fixture.direTeam.id}`}
            className="min-w-0 text-foreground!"
          >
            <TeamBadge name={fixture.direTeam.name} side="dire" size="sm" />
          </Link>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isNext && status === "upcoming" ? (
            <MatchStatusBadge status="upcoming" label="UP NEXT" />
          ) : (
            <MatchStatusBadge status={status} />
          )}
        </div>
      </div>

      {winner && status === "completed" ? (
        <p className="m-0 border-t border-white/10 px-4 py-2 text-sm text-amber-400 sm:px-5">
          {winner} won
        </p>
      ) : null}

      <details className="border-t border-white/10">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:px-5 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-1.5">
            International kickoff times
            <span aria-hidden className="text-muted-foreground/70">
              ▾
            </span>
          </span>
        </summary>
        <div className="px-4 pb-4 sm:px-5">
          <MatchTimeZones at={fixture.scheduledAt} />
        </div>
      </details>
    </EsportsCard>
  );
}

function NightSection({
  label,
  fixtures,
  nextId,
  windowHint,
  now,
}: {
  label: string;
  fixtures: ScheduleFixtureView[];
  nextId: string | undefined;
  windowHint: string;
  now: number;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 font-display text-lg tracking-wide text-foreground">
          {label}
        </h3>
        <span className="text-sm text-muted-foreground">
          {fixtures.length} match{fixtures.length === 1 ? "" : "es"} · {windowHint}
        </span>
      </div>
      <div className="grid gap-3">
        {fixtures.map((fixture) => (
          <FixtureCard
            key={fixture.id}
            fixture={fixture}
            isNext={nextId === fixture.id}
            now={now}
          />
        ))}
      </div>
    </section>
  );
}

function nightWindowHint(fixtures: ScheduleFixtureView[]) {
  return fixtures.some((fixture) => isPlayoffKind(fixture.kind))
    ? "10:00 AM–3:00 AM PKT"
    : "10:00 PM–6:00 AM PKT";
}

export function CupScheduleBoard({
  fixtures,
}: {
  fixtures: ScheduleFixtureView[];
}) {
  const [now] = useState(() => Date.now());
  const upcoming = fixtures.filter((fixture) => fixture.status === "scheduled");
  const nextId = upcoming[0]?.id;

  const { saturdayNights, sundayNights, playoffFixtures, hasPlayoffs } =
    useMemo(() => {
      const nights = groupScheduleByNight(fixtures);
      const saturdayNights = nights.filter((n) =>
        n.label.startsWith("Saturday"),
      );
      const sundayNights = nights.filter((n) => n.label.startsWith("Sunday"));
      const playoffFixtures = fixtures
        .filter((f) => isPlayoffKind(f.kind))
        .slice()
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() -
            new Date(b.scheduledAt).getTime(),
        );
      return {
        saturdayNights,
        sundayNights,
        playoffFixtures,
        hasPlayoffs: playoffFixtures.length > 0,
      };
    }, [fixtures]);

  if (fixtures.length === 0) {
    return (
      <div className="empty-panel teams-list-empty">
        <p className="muted" style={{ margin: 0 }}>
          No matches booked yet. Waiting on rosters and the first fixture.
          When teams are ready, the weekend schedule appears here.
        </p>
      </div>
    );
  }

  const defaultTab =
    saturdayNights.length > 0
      ? "saturday"
      : sundayNights.length > 0
        ? "sunday"
        : hasPlayoffs
          ? "playoffs"
          : "saturday";

  return (
    <div className="cup-schedule">
      <Tabs defaultValue={defaultTab} className="gap-4">
        <TabsList variant="line" className="w-full max-w-md">
          <TabsTrigger value="saturday" disabled={saturdayNights.length === 0}>
            Saturday
          </TabsTrigger>
          <TabsTrigger value="sunday" disabled={sundayNights.length === 0}>
            Sunday
          </TabsTrigger>
          {hasPlayoffs ? (
            <TabsTrigger value="playoffs">Playoffs</TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="saturday" className="grid gap-6">
          {saturdayNights.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">
              No Saturday fixtures booked.
            </p>
          ) : (
            saturdayNights.map((night) => (
              <NightSection
                key={night.label}
                label={night.label}
                fixtures={night.fixtures}
                nextId={nextId}
                windowHint={nightWindowHint(night.fixtures)}
                now={now}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="sunday" className="grid gap-6">
          {sundayNights.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">
              No Sunday fixtures booked.
            </p>
          ) : (
            sundayNights.map((night) => (
              <NightSection
                key={night.label}
                label={night.label}
                fixtures={night.fixtures}
                nextId={nextId}
                windowHint={nightWindowHint(night.fixtures)}
                now={now}
              />
            ))
          )}
        </TabsContent>

        {hasPlayoffs ? (
          <TabsContent value="playoffs" className="grid gap-6">
            <NightSection
              label="Playoffs"
              fixtures={playoffFixtures}
              nextId={nextId}
              windowHint="10:00 AM–3:00 AM PKT"
              now={now}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
