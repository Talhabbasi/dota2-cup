import Image from "next/image";
import Link from "next/link";
import { formatScheduleWhen } from "@/lib/schedule";
import { HeroSlideshow } from "@/components/hero-slideshow";
import { MatchCountdown } from "@/components/match-countdown";
import type { FixturePreview } from "@/lib/data";
import { toIso } from "@/lib/format";

function seriesLabel(kind?: string, bestOf?: number) {
  const bo = `Bo${bestOf ?? 1}`;
  switch (kind) {
    case "final":
      return `Grand Final · ${bo}`;
    case "adv":
      return `Advancement · ${bo}`;
    case "ub_final":
      return `Upper Final · ${bo}`;
    case "lb_final":
      return `Lower Final · ${bo}`;
    case "ub":
      return `Upper bracket · ${bo}`;
    case "lb":
      return `Lower bracket · ${bo}`;
    case "group":
      return `Group stage · ${bo}`;
    default:
      return `Best of ${bestOf ?? 1}`;
  }
}

export function HomeHero({
  upcoming,
  teamCount,
  matchCount,
  marquee,
  seasonLabel,
}: {
  upcoming: FixturePreview | null;
  teamCount: number;
  matchCount: number;
  marquee: string[];
  seasonLabel?: string | null;
}) {
  const names = marquee.length > 0 ? [...marquee, ...marquee] : [];

  return (
    <section className="hero-stage">
      <HeroSlideshow />
      <div className="hero-stage-shade" aria-hidden />
      <div className="hero-stage-fx" aria-hidden>
        <span className="hero-orb hero-orb-gold" />
        <span className="hero-orb hero-orb-radiant" />
        <span className="hero-orb hero-orb-dire" />
        <span className="hero-hex" />
        <span className="hero-scan" />
      </div>

      <div className="hero-stage-inner">
        <p className="hero-kicker animate-rise">
          <span className="hero-kicker-dot" />
          Indoor MM · Pakistan · Eight franchises
        </p>
        <h1 className="hero-title animate-rise delay-1">
          <Image
            src="/mm-dota-cup-icon.png"
            alt=""
            width={92}
            height={92}
            className="hero-title-icon"
            priority
          />
          <span className="hero-title-text">
            <span>MM Dota</span>
            <span>
              Cup{seasonLabel ? ` ${seasonLabel}` : ""}
            </span>
          </span>
        </h1>
        <p className="hero-tagline animate-rise delay-2">
          Two groups. One bracket. Every night on the clock.
        </p>
        <p className="hero-lead animate-rise delay-2">
          Saturday and Sunday indoor matches, group stage into a live playoff
          graph. Captains, rosters, and kickoffs — all in one place.
        </p>
        <div className="hero-ctas animate-rise delay-3">
          <Link href="/schedule" className="btn btn-gold">
            Open schedule
          </Link>
          <Link href="/playoffs" className="btn">
            Tournament graph
          </Link>
          <Link href="/teams" className="btn btn-ghost">
            Franchises
          </Link>
        </div>

        <ul className="hero-pills animate-rise delay-3">
          <li>
            <b>{teamCount}</b>
            <span>Teams</span>
          </li>
          <li>
            <b>{matchCount}</b>
            <span>Matches logged</span>
          </li>
          <li>
            <b>Bo3</b>
            <span>Grand Final</span>
          </li>
          <li>
            <b>PKT</b>
            <span>All kickoffs</span>
          </li>
        </ul>

        {upcoming ? (
          <div className="hero-next animate-rise delay-3">
            <div className="hero-next-copy">
              <p className="hero-next-kicker">Next series</p>
              <p className="hero-next-matchup">
                <span>{upcoming.radiantTeam.name}</span>
                <em>vs</em>
                <span>{upcoming.direTeam.name}</span>
              </p>
              <p className="hero-next-meta">
                {seriesLabel(upcoming.kind, upcoming.bestOf)}
                {upcoming.scheduledAt
                  ? ` · ${formatScheduleWhen(upcoming.scheduledAt)}`
                  : ""}
              </p>
            </div>
            {upcoming.scheduledAt ? (
              <MatchCountdown at={toIso(upcoming.scheduledAt)} />
            ) : null}
          </div>
        ) : null}
      </div>

      {names.length > 0 ? (
        <div className="hero-marquee" aria-hidden>
          <div className="hero-marquee-track">
            {names.map((name, i) => (
              <span key={`${name}-${i}`}>{name}</span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
