import Image from "next/image";
import Link from "next/link";
import type { DigestSeason, GameHomeDigest } from "@/lib/dota-home-digest";

function SeasonCard({ season }: { season: DigestSeason }) {
  const extra = season.matchCount - season.matches.length;
  return (
    <article className="dota-digest-card">
      {season.image ? (
        <Link href={season.href} className="dota-digest-art" tabIndex={-1} aria-hidden="true">
          <Image src={season.image} alt="" fill sizes="(max-width: 760px) 100vw, 280px" />
        </Link>
      ) : null}
      <div className="dota-digest-body">
        <p className="eyebrow">
          {season.stateLabel}
        </p>
        <h3>
          <Link href={season.href}>{season.title}</Link>
        </h3>
        <p className="dota-digest-plan">{season.plan}</p>
        {season.championName ? (
          <p className="dota-digest-winner">
            Champion <Link href={season.href}>{season.championName}</Link>
          </p>
        ) : null}
        {season.finalLine ? <p className="dota-digest-final">{season.finalLine}</p> : null}
        {season.matches.length > 0 ? (
          <ul className="dota-digest-matches">
            {season.matches.map((match) => (
              <li key={match.id}>
                <Link href={match.href} className="dota-digest-match">
                  <span className="dota-digest-detail">{match.detail}</span>
                  <span className={match.winner === match.radiant ? "is-win" : undefined}>
                    {match.radiant}
                  </span>
                  <span className="dota-digest-score">{match.kills ?? "vs"}</span>
                  <span className={match.winner === match.dire ? "is-win" : undefined}>
                    {match.dire}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {extra > 0 ? (
          <p className="dota-digest-more">
            <Link href={season.matchesHref} className="text-link">
              All {season.matchCount} maps →
            </Link>
          </p>
        ) : null}
      </div>
    </article>
  );
}

export function DotaSeasonDigest({ digest }: { digest: GameHomeDigest }) {
  if (digest.coming.length === 0 && digest.recent.length === 0) return null;

  return (
    <div className="dota-digest">
      {digest.coming.length > 0 ? (
        <section aria-labelledby="digest-coming">
          <div className="section-head">
            <h2 id="digest-coming">Coming up</h2>
          </div>
          <div className="dota-digest-stack">
            {digest.coming.map((season) => (
              <SeasonCard key={season.id} season={season} />
            ))}
          </div>
        </section>
      ) : null}

      {digest.recent.length > 0 ? (
        <section aria-labelledby="digest-recent">
          <div className="section-head">
            <h2 id="digest-recent">Recent seasons</h2>
            <p className="m-0 text-sm text-muted-foreground">
              Who won, the grand final, and the latest recorded maps. The winning side is highlighted.
            </p>
          </div>
          <div className="dota-digest-stack">
            {digest.recent.map((season) => (
              <SeasonCard key={season.id} season={season} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
