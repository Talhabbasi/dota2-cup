"use client";

import { useMemo, useState } from "react";
import { Pagination, usePagedList } from "@/components/pagination";
import { MatchCard, type MatchCardMatch } from "@/components/match-card";
import { matchKillTotals } from "@/lib/match-score";
import {
  MATCH_KIND_FILTERS,
  type MatchKind,
  type MatchNarrative,
} from "@/lib/match-narrative";

export type MatchListView = MatchCardMatch & {
  killDiff: number;
  totalKills: number;
  narrative: MatchNarrative | null;
};

type SortKey = "newest" | "duration" | "stomps" | "bloodiest" | "closest";

export function MatchSeasonTabs({
  sections,
}: {
  sections: { id: string; label: string; note: string; matches: MatchListView[] }[];
}) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const active = sections.find((section) => section.id === activeId) ?? sections[0];
  if (!active) return null;

  return (
    <div>
      <div className="team-view-toggle team-season-tabs" role="tablist" aria-label="Season matches">
        {sections.map((section) => {
          const on = section.id === active.id;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={on ? "active" : ""}
              onClick={() => setActiveId(section.id)}
            >
              {section.label}
            </button>
          );
        })}
      </div>
      <p className="team-season-note">{active.note}</p>
      {active.matches.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">No recorded maps for this season.</p>
      ) : (
        <MatchesGrid matches={active.matches} />
      )}
    </div>
  );
}

export function MatchesGrid({ matches }: { matches: MatchListView[] }) {
  const [sort, setSort] = useState<SortKey>("newest");
  const [kind, setKind] = useState<MatchKind | "any">("any");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return matches.filter((m) => {
      if (kind !== "any") {
        if (!m.narrative || m.narrative.kind !== kind) return false;
      }
      if (!q) return true;
      const hay = [
        m.radiantTeam?.name,
        m.direTeam?.name,
        m.winnerTeam?.name,
        m.openDotaId,
        m.narrative?.label,
        m.roundLabel,
        m.seasonLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [matches, kind, query]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    switch (sort) {
      case "duration":
        list.sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0));
        break;
      case "stomps":
        list.sort((a, b) => b.killDiff - a.killDiff);
        break;
      case "bloodiest":
        list.sort((a, b) => b.totalKills - a.totalKills);
        break;
      case "closest":
        list.sort((a, b) => a.killDiff - b.killDiff);
        break;
      default:
        list.sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime(),
        );
    }
    return list;
  }, [filtered, sort]);

  const { page, pageCount, slice, setPage } = usePagedList(sorted, 8);

  const withScore = matches.filter((m) =>
    matchKillTotals(m.players, {
      radiantScore: m.radiantScore,
      direScore: m.direScore,
    }).hasScore,
  ).length;

  return (
    <>
      <div className="matches-list-controls">
        <label className="matches-search">
          <span className="sr-only">Search matches</span>
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Team name or match id"
            className="matches-search-input"
          />
        </label>

        <div className="teams-list-toolbar matches-filter-row">
          <p className="muted teams-list-count">
            <strong>{sorted.length}</strong> match
            {sorted.length === 1 ? "" : "es"}
            {withScore > 0 ? (
              <>
                {" "}
                · <strong>{withScore}</strong> with kill scores
              </>
            ) : null}
          </p>
        </div>

        <div
          className="team-view-toggle matches-kind-toggle"
          role="tablist"
          aria-label="Filter by match kind"
        >
          {MATCH_KIND_FILTERS.map((row) => (
            <button
              key={row.key}
              type="button"
              role="tab"
              aria-selected={kind === row.key}
              className={kind === row.key ? "active" : ""}
              onClick={() => {
                setKind(row.key);
                setPage(1);
              }}
            >
              {row.label}
            </button>
          ))}
        </div>

        <div
          className="team-view-toggle"
          role="tablist"
          aria-label="Sort matches"
        >
          {(
            [
              ["newest", "Latest"],
              ["duration", "Longest"],
              ["closest", "Closest"],
              ["stomps", "Biggest gap"],
              ["bloodiest", "Bloodiest"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={sort === key}
              className={sort === key ? "active" : ""}
              onClick={() => {
                setSort(key);
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {slice.length === 0 ? (
        <p className="muted">No matches match that filter.</p>
      ) : (
        <div className="matches-grid-stack">
          {slice.map((match) => (
            <MatchCard key={match.id} match={match} showDate />
          ))}
        </div>
      )}
      <Pagination page={page} pageCount={pageCount} onPage={setPage} />
    </>
  );
}

