"use client";

import Link from "next/link";
import { useState } from "react";
import { MatchCountdown } from "@/components/match-countdown";
import { useHeroSlideSync } from "@/components/hero-slide-sync";
import type {
  HeroActiveSlide,
  HeroBannerSlide,
  HeroChampionSlide,
} from "@/lib/homepage-hero";

function teamHref(teamId: string, seasonNumber?: number) {
  return seasonNumber
    ? `/teams/${teamId}?season=${seasonNumber}`
    : `/teams/${teamId}`;
}

function shortTeamName(name: string) {
  return name.replace(/^Team\s+/i, "").trim() || name;
}

function ActiveSlideBody({ slide }: { slide: HeroActiveSlide }) {
  return (
    <div className="hero-banner-slide-grid is-full">
      <div className="hero-banner-copy is-wide is-centered">
        <p className="hero-slide-kicker">{slide.title}</p>
        <p className="hero-slide-lead">{slide.lead}</p>
        <dl className="hero-slide-stats">
          <div>
            <dt>Teams</dt>
            <dd>
              {slide.registeredTeams > 0 &&
              slide.registeredTeams !== slide.teamCount
                ? `${slide.registeredTeams}/${slide.teamCount}`
                : String(slide.teamCount)}
            </dd>
          </div>
          <div>
            <dt>Pool</dt>
            <dd>{slide.prizePoolLabel.replace(/^Rs\s+/i, "Rs ")}</dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>{slide.formatLabel}</dd>
          </div>
        </dl>
        {slide.countdownIso ? (
          <div className="hero-slide-countdown is-centered">
            <span className="hero-slide-countdown-label">
              {slide.countdownLabel}
            </span>
            <MatchCountdown at={slide.countdownIso} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChampionSlideBody({ slide }: { slide: HeroChampionSlide }) {
  return (
    <div className="hero-banner-slide-grid is-full">
      <div className="hero-banner-copy is-wide is-centered">
        <p className="hero-slide-kicker">{slide.title}</p>
        <p className="hero-slide-lead">
          {shortTeamName(slide.championTeam.name)} takes the cup
          {slide.finalScore ? ` in a ${slide.finalScore} Grand Final` : ""}.
        </p>
        <dl className="hero-slide-stats">
          <div>
            <dt>Champion</dt>
            <dd>
              <Link
                href={teamHref(slide.championTeam.id, slide.seasonNumber)}
                className="hero-champion-link"
              >
                {shortTeamName(slide.championTeam.name)}
              </Link>
            </dd>
          </div>
          <div>
            <dt>Final</dt>
            <dd>{slide.finalScore ?? "—"}</dd>
          </div>
          <div>
            <dt>MVP</dt>
            <dd>
              {slide.mvpPlayer ? (
                <Link
                  href={`/players/${slide.mvpPlayer.id}?season=${slide.seasonNumber}`}
                  className="hero-champion-link"
                >
                  {slide.mvpPlayer.steamName}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
        <div className="hero-ctas is-centered">
          <Link href={slide.archiveHref} className="btn btn-gold">
            View Season {slide.seasonNumber} Summary
          </Link>
          <Link
            href={teamHref(slide.championTeam.id, slide.seasonNumber)}
            className="btn"
          >
            Champion roster
          </Link>
        </div>
      </div>
    </div>
  );
}

export function HomeHeroCarousel({ slides }: { slides: HeroBannerSlide[] }) {
  const multi = slides.length > 1;
  const { step, setPaused, goToStep, bump } = useHeroSlideSync();
  const [touchX, setTouchX] = useState<number | null>(null);
  const slideCount = slides.length;
  const safeIndex = slideCount === 0 ? 0 : step % slideCount;

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
        if (Math.abs(delta) > 40) {
          if (delta < 0) bump();
          else goToStep(Math.max(0, step - 1));
        }
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
        <div
          className="hero-banner-controls"
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
              onClick={() => goToStep(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
