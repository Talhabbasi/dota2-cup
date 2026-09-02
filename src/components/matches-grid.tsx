"use client";

import { useMemo, useState } from "react";
import { Pagination, usePagedList } from "@/components/pagination";
import { MatchCard, type MatchCardMatch } from "@/components/match-card";
import { matchKillTotals } from "@/lib/match-score";

export type MatchListView = MatchCardMatch & {
  killDiff: number;
};

type SortKey = "newest" | "oldest" | "duration" | "stomps";

export function MatchesGrid({ matches }: { matches: MatchListView[] }) {
  const [sort, setSort] = useState<SortKey>("newest");

  const sorted = useMemo(() => {
    const list = [...matches];
    switch (sort) {
      case "oldest":
        list.sort(
          (a, b) =>
            new Date(a.createdAt ?? 0).getTime() -
            new Date(b.createdAt ?? 0).getTime(),
        );
        break;
      case "duration":
        list.sort(
          (a, b) => (b.duration ?? 0) - (a.duration ?? 0),
        );
        break;
      case "stomps":
        list.sort((a, b) => b.killDiff - a.killDiff);
        break;
      default:
        list.sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() -
            new Date(a.createdAt ?? 0).getTime(),
        );
    }
    return list;
  }, [matches, sort]);

  const { page, pageCount, slice, setPage } = usePagedList(sorted, 8);

  const withScore = matches.filter((m) =>
    matchKillTotals(m.players).hasScore,
  ).length;

  return (
    <>
      <div className="teams-list-toolbar">
        <p className="muted teams-list-count">
          <strong>{matches.length}</strong> match{matches.length === 1 ? "" : "es"}
          {withScore > 0 ? (
            <>
              {" "}
              · <strong>{withScore}</strong> with kill scores
            </>
          ) : null}
        </p>
        <div className="team-view-toggle" role="tablist" aria-label="Sort matches">
          <button
            type="button"
            role="tab"
            aria-selected={sort === "newest"}
            className={sort === "newest" ? "active" : ""}
            onClick={() => setSort("newest")}
          >
            Newest
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sort === "duration"}
            className={sort === "duration" ? "active" : ""}
            onClick={() => setSort("duration")}
          >
            Longest
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sort === "stomps"}
            className={sort === "stomps" ? "active" : ""}
            onClick={() => setSort("stomps")}
          >
            Biggest gap
          </button>
        </div>
      </div>

      <div className="matches-grid-stack">
        {slice.map((match) => (
          <MatchCard key={match.id} match={match} showDate />
        ))}
      </div>
      <Pagination page={page} pageCount={pageCount} onPage={setPage} />
    </>
  );
}
