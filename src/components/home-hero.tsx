import Image from "next/image";
import { HeroSlideshow } from "@/components/hero-slideshow";
import { HomeHeroCarousel } from "@/components/home-hero-carousel";
import { CUP_ICON_PATH, cupKicker, cupNameLines } from "@/lib/brand";
import type { HeroBannerSlide } from "@/lib/homepage-hero";
import {
  SEASON_PHASE,
  seasonPlanLine,
} from "@/lib/season-constants";
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

export function HomeHero({
  slides,
  seasonPlan,
  seasonLabel,
}: {
  slides: HeroBannerSlide[];
  seasonPlan?: HeroSeasonPlan | null;
  seasonLabel?: string | null;
}) {
  const [titleLead, titleTail] = cupNameLines();
  const active = slides.find((slide) => slide.kind === "active");
  const firstChampion = slides.find((slide) => slide.kind === "champion");
  const crownedOnly =
    !active && Boolean(firstChampion) && slides.every((s) => s.kind === "champion");

  const planLine = seasonPlan
    ? seasonPlanLine({
        number: seasonPlan.number,
        teamCount: seasonPlan.teamCount,
        plannedStartAt: seasonPlan.plannedStartAt,
        startedAt: seasonPlan.startedAt,
        phase: seasonPlan.phase,
      })
    : null;
  const brandKicker = cupKicker(seasonPlan?.teamCount ?? active?.teamCount);
  const seasonBit =
    seasonLabel ??
    (active ? `Season ${active.seasonNumber}` : null) ??
    (firstChampion ? firstChampion.seasonName : null);

  const upcomingMode =
    Boolean(active) &&
    (active!.phase === SEASON_PHASE.UPCOMING ||
      active!.phase === SEASON_PHASE.AUCTION_ACTIVE);

  return (
    <section className={cn("hero-stage", crownedOnly && "hero-stage-champion")}>
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
              crownedOnly && "hero-kicker-dot-complete",
            )}
          />
          {crownedOnly
            ? `${seasonBit ?? brandKicker} · Archive`
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
              {seasonBit && !crownedOnly ? ` ${seasonBit}` : ""}
            </span>
          </span>
        </h1>

        {slides.length > 0 ? (
          <HomeHeroCarousel slides={slides} />
        ) : (
          <>
            <p className="hero-tagline animate-rise delay-2">
              {planLine ?? "Next season coming soon"}
            </p>
            <p className="hero-lead animate-rise delay-2">
              The last tournament is in the archive. Organizers will open a new
              season when registration and auction are ready.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
