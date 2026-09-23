import Link from "next/link";
import {
  EsportsTable,
  EsportsTableBody,
  EsportsTableCell,
  EsportsTableHead,
  EsportsTableHeader,
  EsportsTableRow,
  TeamBadge,
} from "@/components/common";
import type { GroupStandingRow } from "@/lib/group-stage-schedule";
import { cn } from "@/lib/utils";

function rowTone(rank: number, eliminated: boolean) {
  if (eliminated) return "opacity-50";
  if (rank <= 2) return "border-l-4 border-amber-500 bg-amber-500/5";
  if (rank === 3) return "border-l-4 border-cyan-400 bg-cyan-400/5";
  return "";
}

export function GroupStandingsTable({
  title,
  rows,
  markLastEliminated = false,
}: {
  title: string;
  rows: GroupStandingRow[];
  markLastEliminated?: boolean;
}) {
  return (
    <section className="grid gap-3">
      <h2 className="m-0 font-display text-xl tracking-wide text-foreground">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">
          No teams in this group yet.
        </p>
      ) : (
        <EsportsTable>
          <EsportsTableHeader>
            <EsportsTableRow className="hover:bg-transparent">
              <EsportsTableHead className="w-12">#</EsportsTableHead>
              <EsportsTableHead>Team</EsportsTableHead>
              {(["P", "W", "L", "PTS"] as const).map((label) => (
                <EsportsTableHead key={label} className="text-right!">
                  {label}
                </EsportsTableHead>
              ))}
            </EsportsTableRow>
          </EsportsTableHeader>
          <EsportsTableBody>
            {rows.map((row, index) => {
              const rank = index + 1;
              const eliminated =
                markLastEliminated && index === rows.length - 1;
              return (
                <EsportsTableRow
                  key={row.id}
                  className={cn(rowTone(rank, eliminated))}
                >
                  <EsportsTableCell className="w-12 font-mono text-sm tabular-nums text-muted-foreground">
                    {rank}
                  </EsportsTableCell>
                  <EsportsTableCell>
                    <Link
                      href={`/teams/${row.id}`}
                      className="inline-flex min-w-0 items-center gap-2 text-foreground!"
                    >
                      <TeamBadge name={row.name} size="sm" />
                      {eliminated ? (
                        <span className="text-[0.65rem] font-semibold tracking-[0.12em] text-red-400 uppercase">
                          Eliminated
                        </span>
                      ) : null}
                    </Link>
                  </EsportsTableCell>
                  <EsportsTableCell className="text-right! font-mono text-sm tabular-nums">
                    {row.played}
                  </EsportsTableCell>
                  <EsportsTableCell className="text-right! font-mono text-sm tabular-nums">
                    {row.wins}
                  </EsportsTableCell>
                  <EsportsTableCell className="text-right! font-mono text-sm tabular-nums">
                    {row.losses}
                  </EsportsTableCell>
                  <EsportsTableCell className="text-right! font-mono text-sm font-bold tabular-nums text-amber-400">
                    {row.points}
                  </EsportsTableCell>
                </EsportsTableRow>
              );
            })}
          </EsportsTableBody>
        </EsportsTable>
      )}
    </section>
  );
}
