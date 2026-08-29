import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getHeroBySlug,
  getHeroMatchAppearances,
} from "@/lib/heroes";
import { formatDuration } from "@/lib/data";
import { itemIconUrl, heroPortraitUrl } from "@/lib/opendota";

export const dynamic = "force-dynamic";

export default async function HeroDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hero = await getHeroBySlug(slug);
  if (!hero) notFound();

  const appearances = await getHeroMatchAppearances(hero.id, hero.name);

  return (
    <div className="page">
      <Link href="/heroes" className="back-link">
        ← Heroes
      </Link>

      <section className="hero-detail-banner">
        <Image
          src={heroPortraitUrl(hero.slug)}
          alt={hero.name}
          width={512}
          height={288}
          className="hero-detail-art"
          priority
        />
        <div className="hero-detail-copy">
          <p className="eyebrow">Hero</p>
          <h1>{hero.name}</h1>
          <p className="lede" style={{ marginBottom: 0 }}>
            {[hero.primaryAttr, hero.attackType, ...(hero.roles ?? [])]
              .filter(Boolean)
              .join(" · ") || "Dota 2"}
          </p>
          <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
            {appearances.length === 0
              ? "Not played yet"
              : appearances.length === 1
                ? "Played 1 time"
                : `Played ${appearances.length} times`}
          </p>
        </div>
      </section>

      {appearances.length === 0 ? (
        <p className="muted">No tournament matches with this hero yet.</p>
      ) : (
        <div className="hero-match-stack">
          {appearances.map((row) => {
            const winner =
              row.match.winnerTeam?.name ??
              (row.match.radiantWin ? "Radiant" : "Dire");
            const sideLabel = row.side === "radiant" ? "Radiant" : "Dire";
            return (
              <article key={row.id} className="hero-match-card">
                <div className="hero-match-top">
                  <div>
                    <Link href={`/matches/${row.match.id}`} className="hero-match-title">
                      {row.match.radiantTeam?.name ?? "Radiant"}{" "}
                      <span className="muted">vs</span>{" "}
                      {row.match.direTeam?.name ?? "Dire"}
                    </Link>
                    <p className="muted">
                      {sideLabel}
                      {row.player ? (
                        <>
                          {" · "}
                          <Link href={`/players/${row.player.id}`}>
                            {row.player.steamName}
                          </Link>
                        </>
                      ) : null}
                      {row.player?.team?.name
                        ? ` · ${row.player.team.name}`
                        : ""}{" "}
                      · Winner {winner} · {formatDuration(row.match.duration)}
                    </p>
                  </div>
                  <div className="hero-kda">
                    <strong>
                      {row.kills}/{row.deaths}/{row.assists}
                    </strong>
                    <span className="muted">KDA</span>
                  </div>
                </div>

                <div className="hero-stat-row">
                  <span>LH {row.lastHits}</span>
                  <span>DN {row.denies}</span>
                  <span>GPM {row.gpm}</span>
                  <span>XPM {row.xpm}</span>
                </div>

                <div className="item-row">
                  {row.items.length === 0 ? (
                    <span className="muted">No items</span>
                  ) : (
                    row.items.map((item, i) =>
                      item.key ? (
                        <div key={`${row.id}-${i}`} className="item-chip" title={item.name}>
                          <Image
                            src={itemIconUrl(item.key)}
                            alt={item.name}
                            width={48}
                            height={36}
                            className="item-icon"
                          />
                        </div>
                      ) : (
                        <span key={`${row.id}-${i}`} className="item-chip text">
                          {item.name}
                        </span>
                      ),
                    )
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
