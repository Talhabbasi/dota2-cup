"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  EsportsTable,
  EsportsTableBody,
  EsportsTableCell,
  EsportsTableHead,
  EsportsTableHeader,
  EsportsTableRow,
} from "@/components/common/esports-table";
import {
  AdminEmpty,
  AdminToolbar,
  adminControlClass,
} from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export type AdminPredictionRow = {
  rank: number;
  name: string;
  points: number;
  correct: number;
  picks: number;
};

export function AdminPredictionsBoard({
  rows,
}: {
  rows: AdminPredictionRow[];
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [pointsFilter, setPointsFilter] = useState("");

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (pointsFilter === "top" && row.rank > 10) return false;
      if (pointsFilter === "scored" && row.points <= 0) return false;
      if (pointsFilter === "zero" && row.points !== 0) return false;
      if (q && !row.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, deferredQuery, pointsFilter]);

  return (
    <div>
      <AdminToolbar
        title="Predictions"
        count={filtered.length}
        hint="Names and points — admin view, always visible."
      >
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
          <label className="flex min-w-[9rem] flex-col gap-1 text-[0.65rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            Points
            <select
              value={pointsFilter}
              onChange={(e) => setPointsFilter(e.target.value)}
              className={cn(adminControlClass, "normal-case")}
            >
              <option value="">All</option>
              <option value="top">Top 10</option>
              <option value="scored">Has points</option>
              <option value="zero">Zero points</option>
            </select>
          </label>
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[0.65rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            Search
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name…"
              className={cn(adminControlClass, "normal-case")}
            />
          </label>
        </div>
      </AdminToolbar>
      {rows.length === 0 ? (
        <AdminEmpty>No predictions yet.</AdminEmpty>
      ) : filtered.length === 0 ? (
        <AdminEmpty>No rows match these filters.</AdminEmpty>
      ) : (
        <div className="admin-table-scroll">
          <EsportsTable>
            <EsportsTableHeader>
              <EsportsTableRow>
                <EsportsTableHead className="w-14">#</EsportsTableHead>
                <EsportsTableHead>Name</EsportsTableHead>
                <EsportsTableHead>Points</EsportsTableHead>
                <EsportsTableHead>Correct</EsportsTableHead>
                <EsportsTableHead>Picks</EsportsTableHead>
              </EsportsTableRow>
            </EsportsTableHeader>
            <EsportsTableBody>
              {filtered.map((row) => (
                <EsportsTableRow key={`${row.rank}-${row.name}`}>
                  <EsportsTableCell className="tabular-nums text-muted-foreground">
                    {row.rank}
                  </EsportsTableCell>
                  <EsportsTableCell className="font-medium">
                    {row.name}
                  </EsportsTableCell>
                  <EsportsTableCell className="tabular-nums text-primary">
                    {row.points}
                  </EsportsTableCell>
                  <EsportsTableCell className="tabular-nums">
                    {row.correct}
                  </EsportsTableCell>
                  <EsportsTableCell className="tabular-nums text-muted-foreground">
                    {row.picks}
                  </EsportsTableCell>
                </EsportsTableRow>
              ))}
            </EsportsTableBody>
          </EsportsTable>
        </div>
      )}
    </div>
  );
}
