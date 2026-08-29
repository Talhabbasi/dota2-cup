"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { HeroTournamentStat } from "@/lib/heroes";

type Filter = "all" | "played" | "unplayed";
type SortKey = "plays" | "name";

function playLabel(plays: number) {
  if (plays === 0) return "0";
  if (plays === 1) return "1 play";
  return `${plays} plays`;
}

function HeroTile({ hero }: { hero: HeroTournamentStat }) {
  const played = hero.plays > 0;

  return (
    <Link
      href={`/heroes/${hero.slug}`}
      className={`hero-tile-enhanced ${played ? "played" : "unplayed"}`}
    >
      <div className="hero-tile-art">
        <Image
          src={hero.portrait}
          alt={hero.name}
          width={180}
          height={101}
          className="hero-tile-img"
        />
        {played ? (
          <span className="hero-tile-badge">{hero.plays}</span>
        ) : null}
      </div>
      <div className="hero-tile-meta">
        <span className="hero-tile-name">{hero.name}</span>
        <span className={played ? "hero-plays on" : "hero-plays"}>
          {playLabel(hero.plays)}
        </span>
      </div>
      <span className="hero-tile-cta">Matches →</span>
    </Link>
  );
}

export function HeroesGrid({ heroes }: { heroes: HeroTournamentStat[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("plays");

  const playedCount = heroes.filter((h) => h.plays > 0).length;
  const totalPicks = heroes.reduce((n, h) => n + h.plays, 0);

  const topPicks = useMemo(
    () =>
      [...heroes]
        .filter((h) => h.plays > 0)
        .sort((a, b) => b.plays - a.plays)
        .slice(0, 5),
    [heroes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = heroes.filter((h) => {
      if (filter === "played" && h.plays < 1) return false;
      if (filter === "unplayed" && h.plays > 0) return false;
      if (!q) return true;
      return h.name.toLowerCase().includes(q);
    });

    list = [...list];
    if (sort === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      list.sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name));
    }
    return list;
  }, [heroes, query, filter, sort]);

  return (
    <div className="heroes-board">
      {topPicks.length > 0 && filter === "all" && !query ? (
        <section className="heroes-hot-picks">
          <div className="heroes-hot-head">
            <h2>Most picked</h2>
            <p className="muted">Top heroes in cup matches so far</p>
          </div>
          <div className="heroes-hot-strip">
            {topPicks.map((hero, i) => (
              <Link
                key={hero.id}
                href={`/heroes/${hero.slug}`}
                className="heroes-hot-card"
              >
                <span className="heroes-hot-rank">#{i + 1}</span>
                <Image
                  src={hero.icon}
                  alt=""
                  width={48}
                  height={48}
                  className="heroes-hot-icon"
                />
                <span className="heroes-hot-name">{hero.name}</span>
                <span className="heroes-hot-plays">{hero.plays} picks</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="heroes-panel">
        <div className="heroes-toolbar">
          <label className="players-search heroes-search-wrap">
            <span className="sr-only">Search heroes</span>
            <input
              className="heroes-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search heroes…"
            />
          </label>

          <div className="heroes-toolbar-row">
            <div className="team-view-toggle" role="tablist" aria-label="Filter heroes">
              {(
                [
                  ["all", `All ${heroes.length}`],
                  ["played", `Played ${playedCount}`],
                  ["unplayed", "Not played"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  className={filter === key ? "active" : ""}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="team-view-toggle" role="tablist" aria-label="Sort heroes">
              <button
                type="button"
                role="tab"
                aria-selected={sort === "plays"}
                className={sort === "plays" ? "active" : ""}
                onClick={() => setSort("plays")}
              >
                Most picked
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sort === "name"}
                className={sort === "name" ? "active" : ""}
                onClick={() => setSort("name")}
              >
                A–Z
              </button>
            </div>
          </div>
        </div>

        <p className="muted heroes-result-count">
          Showing <strong>{filtered.length}</strong> heroes
          {totalPicks > 0 ? (
            <>
              {" "}
              · <strong>{totalPicks}</strong> total picks logged
            </>
          ) : null}
        </p>

        {filtered.length === 0 ? (
          <div className="heroes-board-empty muted">No heroes match that search.</div>
        ) : (
          <div className="heroes-grid-enhanced">
            {filtered.map((hero) => (
              <HeroTile key={hero.id} hero={hero} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
