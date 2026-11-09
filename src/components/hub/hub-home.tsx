import Link from "next/link";
import Image from "next/image";
import { ChampionSlider, type ChampionSlide } from "@/components/hub/champion-slider";
import {
  CUP_ICON_PATH,
  CUP_NAME,
  GAME_HOME_HREF,
  PUBG_CUP_NAME,
} from "@/lib/brand";
import type { HubMatchCard, HubMatchStatus, HubOverview } from "@/lib/hub-overview";
import { seasonPlanLine } from "@/lib/season-constants";
import type { FeaturedSeasonForGame } from "@/lib/seasons";
import { toIso } from "@/lib/format";

function stateLabel(state: FeaturedSeasonForGame["state"]) {
  if (state === "live") return "Live now";
  if (state === "upcoming") return "Coming up";
  if (state === "archive") return "Complete";
  return "Not started";
}

function planFor(featured: FeaturedSeasonForGame) {
  const season = featured.season;
  if (!season) return "No season in the database yet.";
  const plan = seasonPlanLine({
    number: season.number,
    teamCount: season.teamCount,
    plannedStartAt: season.plannedStartAt ? toIso(season.plannedStartAt) : null,
    startedAt: season.startedAt ? toIso(season.startedAt) : null,
    phase: season.phase,
  });
  const named =
    season.name && season.name !== `Season ${season.number}` && season.name !== plan
      ? season.name
      : null;
  const champion = season.championName ? `Champion ${season.championName}` : null;
  return [named, plan, champion].filter(Boolean).join(" · ");
}

function spotlightLine(dota: FeaturedSeasonForGame, pubg: FeaturedSeasonForGame) {
  const pick =
    dota.state === "live" ? dota : pubg.state === "live" ? pubg : dota.season ? dota : pubg;
  if (!pick.season) return "No season is live right now.";
  const game = pick.game === "PUBG" ? "PUBG" : "Dota 2";
  return `${game} · ${stateLabel(pick.state)} · ${planFor(pick)}`;
}

function GameCard({
  title,
  href,
  eyebrow,
  image,
  featured,
  links,
}: {
  title: string;
  href: string;
  eyebrow: string;
  image: string;
  featured: FeaturedSeasonForGame;
  links: { href: string; label: string }[];
}) {
  return (
    <article className="arena-game">
      <Image
        src={image}
        alt=""
        fill
        sizes="(min-width: 768px) 50vw, 100vw"
        className="arena-game-img"
      />
      <div className="arena-game-scrim" aria-hidden />
      <div className="arena-game-body">
        <div className="arena-game-top">
          <p>{eyebrow}</p>
          <span className={`arena-status arena-status-${featured.state}`}>
            {stateLabel(featured.state)}
          </span>
        </div>
        <h2>{title}</h2>
        <p>{planFor(featured)}</p>
        <div className="arena-game-actions">
          <Link href={href} className="arena-btn arena-btn-gold">
            View Tournament
          </Link>
          <div className="arena-game-links">
            {links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function MatchColumn({
  title,
  status,
  matches,
  empty,
}: {
  title: string;
  status: HubMatchStatus;
  matches: HubMatchCard[];
  empty: string;
}) {
  return (
    <section className="arena-match-col" aria-labelledby={`arena-${status}`}>
      <header>
        <h3 id={`arena-${status}`}>
          <span className={`arena-dot arena-dot-${status}`} aria-hidden />
          {title}
        </h3>
      </header>
      {matches.length === 0 ? (
        <p className="arena-empty">{empty}</p>
      ) : (
        <ul>
          {matches.map((match) => (
            <li key={match.id}>
              <article className="arena-match">
                <div className="arena-match-meta">
                  <span>{match.game}</span>
                  <span>{match.detail}</span>
                </div>
                <div className="arena-match-teams">
                  <strong>{match.left}</strong>
                  <span className="arena-score">{match.score ?? "vs"}</span>
                  <strong>{match.right}</strong>
                </div>
                <div className="arena-match-foot">
                  <time>{match.when}</time>
                  <Link href={match.href}>Match details</Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function HubHome({
  dota,
  pubg,
  overview,
  champions = [],
}: {
  dota: FeaturedSeasonForGame;
  pubg: FeaturedSeasonForGame;
  overview: HubOverview;
  champions?: ChampionSlide[];
}) {
  const stats = [
    { label: "Active tournaments", value: String(overview.activeTournaments) },
    { label: "Registered teams", value: String(overview.registeredTeams) },
    { label: "Completed matches", value: String(overview.completedMatches) },
    {
      label: "Current season",
      value: overview.currentSeason,
      note: overview.currentSeasonNote,
    },
  ];

  return (
    <div className="hub-home">
      <section className={champions && champions.length > 0 ? "arena-hero arena-hero-has-slider" : "arena-hero"}>
        {champions && champions.length > 0 ? (
          <ChampionSlider slides={champions} />
        ) : (
          <Image
            src="/brand/hero-trophy.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="arena-hero-photo is-on"
          />
        )}
        <div className="arena-hero-shade" aria-hidden />
        <div className="arena-wrap arena-hero-inner">
          <p className="arena-eyebrow">
            <Image src={CUP_ICON_PATH} alt="" width={22} height={22} className="arena-eyebrow-icon" />
            Pakistan&apos;s competitive gaming arena
          </p>
          <h1>
            Where champions
            <span>are made.</span>
          </h1>
          <p className="arena-lede">
            Compete, follow live tournaments, discover elite teams, and experience the next generation of Pakistani esports.
          </p>
          <div className="arena-hero-actions">
            <Link href="#tournaments" className="arena-btn arena-btn-gold">
              Explore Tournaments
            </Link>
            <Link href="#matches" className="arena-btn arena-btn-ghost">
              View Live Matches
            </Link>
          </div>
          <p className="arena-hero-status">{spotlightLine(dota, pubg)}</p>
        </div>
      </section>

      <div className="arena-wrap arena-main">
        <section className="arena-stats" aria-label="Tournament totals">
          {stats.map((stat) => (
            <div key={stat.label}>
              <span>{stat.label}</span>
              <strong className="arena-score">{stat.value}</strong>
              {"note" in stat && stat.note ? <em>{stat.note}</em> : null}
            </div>
          ))}
        </section>

        <section id="tournaments" aria-labelledby="arena-games-heading">
          <div className="arena-section-head">
            <h2 id="arena-games-heading">Tournaments</h2>
            <p>Each game keeps its own seasons, teams, and results.</p>
          </div>
          <div className="arena-game-grid">
            <GameCard
              title={CUP_NAME}
              href={GAME_HOME_HREF.DOTA}
              eyebrow="Dota 2"
              image="/hero-slides/dota-2-juggernaut-ancient.jpg"
              featured={dota}
              links={[
                { href: "/dota/teams", label: "Teams" },
                { href: "/dota/matches", label: "Matches" },
                { href: "/table", label: "Table" },
              ]}
            />
            <GameCard
              title={PUBG_CUP_NAME}
              href={GAME_HOME_HREF.PUBG}
              eyebrow="PUBG"
              image="/pubg/desert.jpg"
              featured={pubg}
              links={[
                { href: "/pubg/teams", label: "Teams" },
                { href: "/pubg/matches", label: "Matches" },
                { href: "/pubg/table", label: "Table" },
              ]}
            />
          </div>
        </section>

        <section id="matches" aria-labelledby="arena-matches-heading">
          <div className="arena-section-head">
            <h2 id="arena-matches-heading">Match board</h2>
            <p>Live, upcoming, and completed maps from the database.</p>
          </div>
          <div className="arena-match-grid">
            <MatchColumn
              title="Live matches"
              status="live"
              matches={overview.live}
              empty="No match is live right now."
            />
            <MatchColumn
              title="Upcoming matches"
              status="upcoming"
              matches={overview.upcoming}
              empty="No fixtures are scheduled ahead."
            />
            <MatchColumn
              title="Completed matches"
              status="completed"
              matches={overview.completed}
              empty="No recorded maps yet."
            />
          </div>
        </section>
      </div>
    </div>
  );
}
