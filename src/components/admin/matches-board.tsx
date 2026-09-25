"use client";

import { AdminDataTable } from "@/components/admin/master-detail";
import { AdminStatus } from "@/components/admin/ui";

export type AdminMatchRow = {
  id: string;
  when: string;
  radiantName: string;
  direName: string;
  winnerName: string | null;
  needsTeam: boolean;
  unmatchedCount: number;
  standInCount: number;
};

export function AdminMatchesBoard({ matches }: { matches: AdminMatchRow[] }) {
  const teamNames = [
    ...new Set(
      matches.flatMap((m) => [m.radiantName, m.direName].filter(Boolean)),
    ),
  ].sort((a, b) => a.localeCompare(b));

  return (
    <AdminDataTable
      title="Matches"
      hint="Click a match to open the full editor (OCR, stand-ins, result)."
      items={matches}
      getId={(m) => m.id}
      hrefFor={(m) => `/admin/matches/${m.id}`}
      searchPlaceholder="Search teams…"
      searchText={(m) => `${m.radiantName} ${m.direName} ${m.winnerName ?? ""}`}
      emptyLabel="No matches uploaded this season."
      filters={[
        {
          key: "status",
          label: "Status",
          options: [
            { value: "needs-teams", label: "Needs teams" },
            { value: "table-ready", label: "Table-ready" },
            { value: "unmatched", label: "Has unmatched" },
            { value: "stand-in", label: "Has stand-in" },
          ],
          match: (m, value) => {
            if (value === "needs-teams") return m.needsTeam;
            if (value === "table-ready") return !m.needsTeam;
            if (value === "unmatched") return m.unmatchedCount > 0;
            if (value === "stand-in") return m.standInCount > 0;
            return true;
          },
        },
        {
          key: "team",
          label: "Team",
          options: teamNames.map((name) => ({ value: name, label: name })),
          match: (m, value) =>
            m.radiantName === value ||
            m.direName === value ||
            m.winnerName === value,
        },
      ]}
      columns={[
        {
          key: "match",
          header: "Match",
          cell: (m) => (
            <span className="font-medium">
              {m.radiantName}{" "}
              <span className="text-muted-foreground">vs</span> {m.direName}
            </span>
          ),
        },
        {
          key: "when",
          header: "When",
          cell: (m) => (
            <span className="text-muted-foreground">{m.when}</span>
          ),
        },
        {
          key: "winner",
          header: "Winner",
          cell: (m) => m.winnerName ?? "—",
        },
        {
          key: "status",
          header: "Status",
          cell: (m) => (
            <span className="flex flex-wrap gap-1">
              {m.needsTeam ? (
                <AdminStatus tone="warn">needs teams</AdminStatus>
              ) : (
                <AdminStatus tone="ok">table-ready</AdminStatus>
              )}
              {m.unmatchedCount > 0 ? (
                <AdminStatus tone="danger">
                  {m.unmatchedCount} unmatched
                </AdminStatus>
              ) : null}
              {m.standInCount > 0 ? (
                <AdminStatus tone="neutral">
                  {m.standInCount} stand-in
                </AdminStatus>
              ) : null}
            </span>
          ),
        },
      ]}
    />
  );
}
