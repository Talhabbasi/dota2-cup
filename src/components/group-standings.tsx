import Link from "next/link";
import type { GroupStandingRow } from "@/lib/group-stage-schedule";

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
    <section className="group-standings">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="muted">No teams in this group yet.</p>
      ) : (
        <div className="group-standings-table" role="table">
          <div className="group-standings-head" role="row">
            <span>Pos</span>
            <span>Team</span>
            <span>P</span>
            <span>W</span>
            <span>L</span>
            <span>Pts</span>
          </div>
          {rows.map((row, index) => {
            const eliminated = markLastEliminated && index === rows.length - 1;
            return (
              <Link
                key={row.id}
                href={`/teams/${row.id}`}
                className={
                  eliminated
                    ? "group-standings-row group-standings-row-out"
                    : "group-standings-row"
                }
                role="row"
              >
                <span>{index + 1}</span>
                <span>
                  {row.name}
                  {eliminated ? (
                    <span className="group-standings-out"> Eliminated</span>
                  ) : null}
                </span>
                <span>{row.played}</span>
                <span>{row.wins}</span>
                <span>{row.losses}</span>
                <span>{row.points}</span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
