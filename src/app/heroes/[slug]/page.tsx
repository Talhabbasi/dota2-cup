import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getHeroBySlug,
  getHeroMatchAppearances,
} from "@/lib/heroes";
import { formatDuration } from "@/lib/data";
import { heroPortraitUrl } from "@/lib/opendota";
import { isMatchStandIn, unmatchedLabel } from "@/lib/stand-in";
import type { Metadata } from "next";
import { CUP_NAME } from "@/lib/brand";

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hero = await getHeroBySlug(slug);
  if (!hero) return { title: "Hero" };
  return {
    title: hero.name,
    description: `${hero.name} in ${CUP_NAME} — Dota 2 hero picks, players, and tournament match history.`,
  };
}

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
        <img
          src={heroPortraitUrl(hero.slug)}
          alt={hero.name}
          width={512}
          height={288}
          className="hero-detail-art"
          decoding="async"
          fetchPriority="high"
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
            const standIn = isMatchStandIn({
              side: row.side,
              unknown: row.unknown,
              playerId: row.player?.id ?? null,
              playerTeamId:
                row.seasonTeamId ??
                row.player?.teamId ??
                row.player?.team?.id ??
                null,
              radiantTeamId: row.match.radiantTeam?.id ?? null,
              direTeamId: row.match.direTeam?.id ?? null,
            });
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
                      {row.player && !row.unknown ? (
                        <>
                          {" · "}
                          {row.boardName.trim() ? `${row.boardName.trim()} · ` : ""}
                          <Link href={`/players/${row.player.id}`}>
                            {row.player.steamName}
                          </Link>
                          {standIn ? " (stand-in)" : ""}
                          {!standIn && row.player.team?.name
                            ? ` · ${row.player.team.name}`
                            : ""}
                        </>
                      ) : (
                        <>
                          {" · "}
                          {unmatchedLabel(row.boardName, row.steam32)}
                        </>
                      )}{" "}
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
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
