import Image from "next/image";
import Link from "next/link";
import { formatScheduleWhen } from "@/lib/schedule";
import {
  EsportsCard,
  FactionBadge,
  StatTile,
  TeamBadge,
} from "@/components/common";
import { HeroSlideshow } from "@/components/hero-slideshow";
import { MatchCountdown } from "@/components/match-countdown";
import type { FixturePreview } from "@/lib/data";
import { toIso } from "@/lib/format";
import { BRACKET_META, isBracketSlot } from "@/lib/playoff-tree";
import { CUP_ICON_PATH, cupKicker, cupNameLines } from "@/lib/brand";
import type { SeasonChampion } from "@/lib/seasons";
import {
  FINAL_BEST_OF,
  SEASON_PHASE,
  formatSeasonStartDate,
  seasonPlanLine,
  tournamentFormatLabel,
} from "@/lib/season-constants";
import {
  seasonHeroLead,
  seasonHeroTagline,
} from "@/lib/season-public-copy";
import { cn } from "@/lib/utils";

export type HeroSeasonPlan = {
  number: number;
  name: string;
  teamCount: number;
  plannedStartAt: string | null;
  startedAt: string | null;
  phase: string;
  tournamentFormat: string;
};

function roundName(kind?: string, slotKey?: string | null) {
  if (slotKey && isBracketSlot(slotKey)) return BRACKET_META[slotKey].round;
  switch (kind) {
    case "final":
      return "Grand Final";
    case "ub_final":
      return "Upper Final";
    case "lb_final":
      return "Lower Final";
    case "ub":
      return "Upper bracket";
    case "lb":
      return "Lower bracket";
    case "adv":
      return "Advancement";
    case "group":
      return "Group stage";
    default:
      return "Series";
  }
}

function seriesFormat(fixture: FixturePreview) {
  const bo = `Bo${fixture.bestOf ?? 1}`;
  const round = roundName(fixture.kind, fixture.slotKey);
  const clock = fixture.scheduledAt
    ? formatScheduleWhen(fixture.scheduledAt).split(" · ").at(-1)
    : null;
  return [bo, round, clock].filter(Boolean).join(" · ");
}

export function HomeHero({
  upcoming,
  teamCount,
  matchCount,
  seasonLabel,
  seasonPlan,
  champion,
  siteMode = "active",
}: {
  upcoming: FixturePreview | null;
  teamCount: number;
  matchCount: number;
  seasonLabel?: string | null;
  seasonPlan?: HeroSeasonPlan | null;
  champion?: SeasonChampion | null;
  siteMode?: "active" | "champion" | "upcoming";
}) {
  const [titleLead, titleTail] = cupNameLines();
  const crowned = siteMode === "champion" && Boolean(champion);
  const upcomingMode = siteMode === "upcoming";
  const starters =
    champion?.players.filter((player) => !player.isSub) ?? [];
  const seasonBit = seasonLabel ?? (champion ? champion.seasonName : null);
  const planLine = seasonPlan
    ? seasonPlanLine({
        number: seasonPlan.number,
        teamCount: seasonPlan.teamCount,
        plannedStartAt: seasonPlan.plannedStartAt,
        startedAt: seasonPlan.startedAt,
        phase: seasonPlan.phase,
      })
    : null;
  const startDisplay =
    formatSeasonStartDate(seasonPlan?.plannedStartAt) ??
    formatSeasonStartDate(seasonPlan?.startedAt);
  const plannedTeams = seasonPlan?.teamCount ?? teamCount;
  const formatLabel = tournamentFormatLabel(seasonPlan?.tournamentFormat);
  const preTournament =
    seasonPlan?.phase === SEASON_PHASE.UPCOMING ||
    seasonPlan?.phase === SEASON_PHASE.AUCTION_ACTIVE;
  const brandKicker = cupKicker(seasonPlan?.teamCount ?? plannedTeams);

  return (
    <section className={cn("hero-stage", crowned && "hero-stage-champion")}>
      <HeroSlideshow />
      <div
        className="hero-stage-shade bg-gradient-to-t from-[#0a0d14] via-[#0a0d14]/75 to-transparent"
        aria-hidden
      />
      <div
        className="hero-stage-shade bg-[radial-gradient(ellipse_at_14%_42%,rgba(10,13,20,0.82),transparent_58%)]"
        aria-hidden
      />
      <div className="hero-stage-fx" aria-hidden>
        <span className="hero-orb hero-orb-gold" />
        <span className="hero-orb hero-orb-radiant" />
        <span className="hero-orb hero-orb-dire" />
        <span className="hero-hex" />
        <span className="hero-scan" />
      </div>

      <div className="hero-stage-inner">
        <p className="hero-kicker animate-rise">
          <span
            className={cn(
              "hero-kicker-dot",
              crowned && "hero-kicker-dot-complete",
            )}
          />
          {crowned
            ? `${seasonBit ?? brandKicker} · Complete`
            : upcomingMode
              ? `${planLine ?? brandKicker} · Upcoming`
              : planLine
                ? planLine
                : brandKicker}
        </p>
        <h1 className="hero-title animate-rise delay-1">
          <Image
            src={CUP_ICON_PATH}
            alt=""
            width={92}
            height={92}
            sizes="(max-width: 720px) 48px, 67px"
            className="hero-title-icon"
          />
          <span className="hero-title-text">
            <span>{titleLead}</span>
            <span>
              {titleTail}
              {seasonBit && !crowned ? ` ${seasonBit}` : ""}
            </span>
          </span>
        </h1>

        {crowned && champion ? (
          <>
            <p className="hero-tagline hero-champion-line animate-rise delay-2">
              {champion.team.name} wins
            </p>
            <p className="hero-lead animate-rise delay-2">
              Tournament complete
              {champion.finalScore
                ? ` · Grand Final ${champion.finalScore}`
                : " · Grand Final champions"}
              . Season {champion.seasonNumber} crown goes to{" "}
              <Link
                href={`/teams/${champion.team.id}`}
                className="hero-champion-link"
              >
                {champion.team.name}
              </Link>
              .
            </p>
            <div className="hero-ctas animate-rise delay-3">
              <Link href={`/teams/${champion.team.id}`} className="btn btn-gold">
                Champion roster
              </Link>
              <Link href="/playoffs" className="btn">
                Final bracket
              </Link>
              <Link href="/seasons" className="btn btn-ghost">
                Season archive
              </Link>
            </div>

            <ul className="m-0 mb-6 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
              <li>
                <StatTile label="Champion" value={champion.team.name.replace(/^Team\s+/i, "")} />
              </li>
              <li>
                <StatTile
                  label="Grand Final"
                  value={
                    champion.finalScore
                      ? `${champion.finalScore}`
                      : `Bo${FINAL_BEST_OF}`
                  }
                />
              </li>
              <li>
                <StatTile label="Matches logged" value={String(matchCount)} />
              </li>
              <li>
                <StatTile label="Teams" value={String(teamCount)} />
              </li>
            </ul>

            {starters.length > 0 ? (
              <p className="hero-champion-roster animate-rise delay-3">
                {starters.map((player, index) => (
                  <span key={player.id}>
                    {index > 0 ? " · " : ""}
                    <Link href={`/players/${player.id}`}>
                      {player.steamName}
                      {player.isCaptain ? " (C)" : ""}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null}
          </>
        ) : upcomingMode ? (
          <>
            <p className="hero-tagline animate-rise delay-2">
              {planLine ?? "Next season coming soon"}
            </p>
            <p className="hero-lead animate-rise delay-2">
              {seasonPlan
                ? seasonHeroLead(
                    {
                      number: seasonPlan.number,
                      name: seasonPlan.name,
                      teamCount: seasonPlan.teamCount,
                      tournamentFormat: seasonPlan.tournamentFormat,
                      plannedStartAt: seasonPlan.plannedStartAt,
                      startedAt: seasonPlan.startedAt,
                      phase: seasonPlan.phase,
                    },
                    { preTournament: true },
                  )
                : "The last tournament is in the archive. Organizers will open a new season when registration and auction are ready."}
            </p>
            <div className="hero-ctas animate-rise delay-3">
              <Link href="/register" className="btn btn-gold">
                Register
              </Link>
              <Link href="/seasons" className="btn">
                Season archive
              </Link>
              <Link href="/playoffs" className="btn btn-ghost">
                Past brackets
              </Link>
            </div>
            {seasonPlan ? (
              <ul className="m-0 mb-6 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
                <li>
                  <StatTile label="Season" value={`S${seasonPlan.number}`} />
                </li>
                <li>
                  <StatTile label="Teams" value={String(plannedTeams)} />
                </li>
                <li>
                  <StatTile
                    label={startDisplay ? "Starts" : "Format"}
                    value={startDisplay ?? formatLabel}
                  />
                </li>
                <li>
                  <StatTile label="Kickoffs" value="PKT" />
                </li>
              </ul>
            ) : null}
          </>
        ) : (
          <>
            <p className="hero-tagline animate-rise delay-2">
              {seasonPlan
                ? seasonHeroTagline({
                    number: seasonPlan.number,
                    name: seasonPlan.name,
                    teamCount: seasonPlan.teamCount,
                    tournamentFormat: seasonPlan.tournamentFormat,
                    plannedStartAt: seasonPlan.plannedStartAt,
                    startedAt: seasonPlan.startedAt,
                    phase: seasonPlan.phase,
                  })
                : planLine ??
                  "Two groups. One bracket. Every night on the clock."}
            </p>
            <p className="hero-lead animate-rise delay-2">
              {seasonPlan
                ? seasonHeroLead(
                    {
                      number: seasonPlan.number,
                      name: seasonPlan.name,
                      teamCount: seasonPlan.teamCount,
                      tournamentFormat: seasonPlan.tournamentFormat,
                      plannedStartAt: seasonPlan.plannedStartAt,
                      startedAt: seasonPlan.startedAt,
                      phase: seasonPlan.phase,
                    },
                    { preTournament },
                  )
                : "Saturday and Sunday indoor matches, group stage into a live playoff graph. Captains, rosters, and kickoffs — all in one place."}
            </p>
            <div className="hero-ctas animate-rise delay-3">
              {preTournament ? (
                <Link href="/register" className="btn btn-gold">
                  Register
                </Link>
              ) : (
                <Link href="/schedule" className="btn btn-gold">
                  Open schedule
                </Link>
              )}
              <Link href="/playoffs" className="btn">
                Tournament graph
              </Link>
              <Link href="/teams" className="btn btn-ghost">
                Franchises
              </Link>
            </div>

            <ul className="m-0 mb-6 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
              <li>
                <StatTile
                  label="Teams"
                  value={
                    teamCount > 0 && teamCount !== plannedTeams
                      ? `${teamCount}/${plannedTeams}`
                      : String(plannedTeams)
                  }
                />
              </li>
              <li>
                <StatTile
                  label={startDisplay ? "Starts" : "Matches logged"}
                  value={
                    startDisplay && preTournament
                      ? startDisplay
                      : String(matchCount)
                  }
                />
              </li>
              <li>
                <StatTile label="Format" value={formatLabel} />
              </li>
              <li>
                <StatTile label="Kickoffs" value="PKT" />
              </li>
            </ul>

            {upcoming ? (
              <EsportsCard className="animate-rise delay-3 overflow-hidden bg-[#121824]/85 backdrop-blur-md">
                <div className="border-b border-white/10 px-5 py-3">
                  <p className="m-0 text-[0.68rem] font-semibold tracking-[0.18em] text-primary uppercase">
                    Next series
                  </p>
                </div>
                <div className="relative px-5 py-5">
                  <span
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-[radial-gradient(ellipse_at_left,rgba(34,197,94,0.16),transparent_70%)]"
                    aria-hidden
                  />
                  <span
                    className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(ellipse_at_right,rgba(239,68,68,0.16),transparent_70%)]"
                    aria-hidden
                  />
                  <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto_1fr]">
                    <ShowdownSide
                      name={upcoming.radiantTeam.name}
                      href={`/teams/${upcoming.radiantTeam.id}`}
                      side="radiant"
                    />
                    <div className="flex flex-col items-center gap-2 text-center">
                      <span className="inline-flex rounded-full border border-primary/40 bg-[#0a0d14]/80 px-3 py-1 font-display text-sm font-bold tracking-[0.22em] text-primary shadow-[0_0_18px_rgba(245,158,11,0.25)]">
                        VS
                      </span>
                      <p className="m-0 text-center text-[0.72rem] tracking-wide text-muted-foreground uppercase md:whitespace-nowrap">
                        {seriesFormat(upcoming)}
                      </p>
                    </div>
                    <ShowdownSide
                      name={upcoming.direTeam.name}
                      href={`/teams/${upcoming.direTeam.id}`}
                      side="dire"
                    />
                  </div>
                  {upcoming.scheduledAt ? (
                    <div className="relative mt-6 flex justify-center">
                      <MatchCountdown at={toIso(upcoming.scheduledAt)} />
                    </div>
                  ) : null}
                </div>
              </EsportsCard>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function ShowdownSide({
  name,
  href,
  side,
}: {
  name: string;
  href: string;
  side: "radiant" | "dire";
}) {
  const radiant = side === "radiant";
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        radiant ? "items-start" : "items-start md:items-end",
      )}
    >
      <FactionBadge side={side} />
      <Link href={href} className={cn(!radiant && "md:text-right")}>
        <TeamBadge
          name={name}
          side={side}
          size="lg"
          className={cn(
            "[&_span]:font-display! [&_span]:text-2xl! [&_span]:font-bold! [&_span]:tracking-wide! [&_span]:uppercase! sm:[&_span]:text-3xl!",
            !radiant && "md:flex-row-reverse",
          )}
        />
      </Link>
    </div>
  );
}
