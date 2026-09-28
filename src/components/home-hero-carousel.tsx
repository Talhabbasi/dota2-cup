"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  EsportsCard,
  FactionBadge,
  StatTile,
  TeamBadge,
} from "@/components/common";
import { MatchCountdown } from "@/components/match-countdown";
import { BRACKET_META, isBracketSlot } from "@/lib/playoff-tree";
import { formatScheduleWhen } from "@/lib/schedule";
import type {
  HeroActiveSlide,
  HeroBannerSlide,
  HeroChampionSlide,
  HeroGrandFinalCard,
} from "@/lib/homepage-hero";
import { cn } from "@/lib/utils";

const HOLD_MS = 7000;

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

function ActiveSlideBody({ slide }: { slide: HeroActiveSlide }) {
  const upcoming = slide.upcoming;
  const seriesBits = upcoming
    ? [
        `Bo${upcoming.bestOf}`,
        roundName(upcoming.kind, upcoming.slotKey),
        upcoming.scheduledAt
          ? formatScheduleWhen(upcoming.scheduledAt).split(" · ").at(-1)
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <div className="hero-banner-slide-grid">
      <div className="hero-banner-copy">
        <p className="hero-tagline animate-rise delay-2">{slide.title}</p>
        <p className="hero-lead animate-rise delay-2">{slide.lead}</p>
        <div className="hero-ctas animate-rise delay-3">
          <Link href={slide.primaryCta.href} className="btn btn-gold">
            {slide.primaryCta.label}
          </Link>
          <Link href={slide.secondaryCta.href} className="btn">
            {slide.secondaryCta.label}
          </Link>
        </div>
        <ul className="m-0 mb-6 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
          <li>
            <StatTile
              label="Teams"
              value={
                slide.registeredTeams > 0 &&
                slide.registeredTeams !== slide.teamCount
                  ? `${slide.registeredTeams}/${slide.teamCount}`
                  : String(slide.teamCount)
              }
            />
          </li>
          <li>
            <StatTile label="Prize pool" value={slide.prizePoolLabel.replace(/^Rs\s+/i, "")} />
          </li>
          <li>
            <StatTile label="Format" value={slide.formatLabel} />
          </li>
          <li>
            <StatTile
              label={slide.countdownLabel}
              value={slide.countdownIso ? "PKT" : "—"}
            />
          </li>
        </ul>
        {slide.countdownIso ? (
          <div className="mb-4 flex justify-start">
            <MatchCountdown at={slide.countdownIso} />
          </div>
        ) : null}
      </div>

      {upcoming ? (
        <EsportsCard className="hero-banner-match animate-rise delay-3 overflow-hidden bg-[#121824]/85 backdrop-blur-md">
          <div className="border-b border-white/10 px-5 py-3">
            <p className="m-0 text-[0.68rem] font-semibold tracking-[0.18em] text-primary uppercase">
              Next series
            </p>
          </div>
          <div className="relative px-5 py-5">
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
                {seriesBits ? (
                  <p className="m-0 text-center text-[0.72rem] tracking-wide text-muted-foreground uppercase md:whitespace-nowrap">
                    {seriesBits}
                  </p>
                ) : null}
              </div>
              <ShowdownSide
                name={upcoming.direTeam.name}
                href={`/teams/${upcoming.direTeam.id}`}
                side="dire"
              />
            </div>
          </div>
        </EsportsCard>
      ) : null}
    </div>
  );
}

function GrandFinalCard({ card }: { card: HeroGrandFinalCard }) {
  const radiantWon = card.winnerTeamId === card.radiant.id;
  const direWon = card.winnerTeamId === card.dire.id;
  return (
    <EsportsCard className="hero-banner-match overflow-hidden bg-[#121824]/85 backdrop-blur-md">
      <div className="border-b border-white/10 px-5 py-3">
        <p className="m-0 text-[0.68rem] font-semibold tracking-[0.18em] text-primary uppercase">
          Grand Final
        </p>
      </div>
      <div className="relative grid items-center gap-4 px-5 py-5 sm:grid-cols-[1fr_auto_1fr]">
        <ShowdownSide
          name={card.radiant.name}
          href={`/teams/${card.radiant.id}`}
          side="radiant"
          won={radiantWon}
        />
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="m-0 font-display text-3xl font-bold tracking-wide text-amber-300 tabular-nums">
            {card.radiantWins}
            <span className="mx-1 text-muted-foreground">–</span>
            {card.direWins}
          </p>
          <p className="m-0 text-[0.68rem] tracking-[0.16em] text-muted-foreground uppercase">
            Bo3
          </p>
        </div>
        <ShowdownSide
          name={card.dire.name}
          href={`/teams/${card.dire.id}`}
          side="dire"
          won={direWon}
        />
      </div>
    </EsportsCard>
  );
}

function ChampionSlideBody({ slide }: { slide: HeroChampionSlide }) {
  return (
    <div className="hero-banner-slide-grid">
      <div className="hero-banner-copy">
        <p className="hero-live animate-rise delay-2">
          {slide.title}
        </p>
        <p className="hero-tagline hero-champion-line animate-rise delay-2">
          {slide.championTeam.name} wins
        </p>
        <p className="hero-lead animate-rise delay-2">
          {slide.finalScore
            ? `Grand Final ${slide.finalScore}`
            : "Grand Final champions"}
          {slide.mvpPlayer ? (
            <>
              {" · "}
              MVP{" "}
              <Link
                href={`/players/${slide.mvpPlayer.id}`}
                className="hero-champion-link"
              >
                {slide.mvpPlayer.steamName}
              </Link>
            </>
          ) : null}
          .
        </p>
        <div className="hero-ctas animate-rise delay-3">
          <Link href={slide.archiveHref} className="btn btn-gold">
            View Season {slide.seasonNumber} Summary
          </Link>
          <Link href={`/teams/${slide.championTeam.id}`} className="btn">
            Champion roster
          </Link>
        </div>
        <ul className="m-0 mb-6 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
          <li>
            <StatTile
              label="Champion"
              value={slide.championTeam.name.replace(/^Team\s+/i, "")}
            />
          </li>
          <li>
            <StatTile
              label="Grand Final"
              value={slide.finalScore ?? "Bo3"}
            />
          </li>
          <li>
            <StatTile
              label="MVP"
              value={slide.mvpPlayer?.steamName ?? "—"}
            />
          </li>
        </ul>
      </div>
      {slide.grandFinal ? <GrandFinalCard card={slide.grandFinal} /> : null}
    </div>
  );
}

function ShowdownSide({
  name,
  href,
  side,
  won,
}: {
  name: string;
  href: string;
  side: "radiant" | "dire";
  won?: boolean;
}) {
  const radiant = side === "radiant";
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        radiant ? "items-start" : "items-start md:items-end",
        won && "opacity-100",
        won === false && "opacity-55",
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
            won && "[&_span]:text-amber-300!",
          )}
        />
      </Link>
      {won ? (
        <span className="text-[0.65rem] font-semibold tracking-[0.14em] text-amber-400 uppercase">
          Winner
        </span>
      ) : null}
    </div>
  );
}

export function HomeHeroCarousel({ slides }: { slides: HeroBannerSlide[] }) {
  const multi = slides.length > 1;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touchX, setTouchX] = useState<number | null>(null);
  const slideCount = slides.length;

  const safeIndex =
    slideCount === 0 ? 0 : Math.min(index, Math.max(0, slideCount - 1));
  if (safeIndex !== index) {
    setIndex(safeIndex);
  }

  const go = useCallback(
    (next: number) => {
      if (slideCount === 0) return;
      setIndex((next + slideCount) % slideCount);
    },
    [slideCount],
  );

  useEffect(() => {
    if (!multi || paused || slideCount < 2) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % slideCount);
    }, HOLD_MS);
    return () => window.clearInterval(id);
  }, [multi, paused, slideCount]);

  if (slides.length === 0) return null;

  const active = slides[safeIndex] ?? slides[0]!;

  return (
    <div
      className="hero-banner-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(event) => {
        setPaused(true);
        setTouchX(event.changedTouches[0]?.clientX ?? null);
      }}
      onTouchEnd={(event) => {
        if (touchX == null) return;
        const end = event.changedTouches[0]?.clientX;
        if (end == null) return;
        const delta = end - touchX;
        if (Math.abs(delta) > 40) go(safeIndex + (delta < 0 ? 1 : -1));
        setTouchX(null);
        setPaused(false);
      }}
    >
      <div
        key={`${active.kind}-${active.seasonId}`}
        className="hero-banner-panel"
      >
        {active.kind === "active" ? (
          <ActiveSlideBody slide={active} />
        ) : (
          <ChampionSlideBody slide={active} />
        )}
      </div>

      {multi ? (
        <div className="hero-banner-controls">
          <button
            type="button"
            className="hero-banner-arrow"
            aria-label="Previous slide"
            onClick={() => go(safeIndex - 1)}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <div
            className="hero-banner-dots"
            role="tablist"
            aria-label="Season slides"
          >
            {slides.map((slide, i) => (
              <button
                key={`${slide.kind}-${slide.seasonId}`}
                type="button"
                role="tab"
                aria-label={slide.title}
                aria-selected={i === safeIndex}
                className={
                  i === safeIndex ? "hero-slide-dot is-active" : "hero-slide-dot"
                }
                onClick={() => go(i)}
              />
            ))}
          </div>
          <button
            type="button"
            className="hero-banner-arrow"
            aria-label="Next slide"
            onClick={() => go(safeIndex + 1)}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}
