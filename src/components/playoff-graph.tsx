import Link from "next/link";
import { formatScheduleWhen } from "@/lib/schedule";
import type { PlayoffMatchView, PlayoffView } from "@/lib/playoff";

export type GroupGraphMatch = {
  id: string;
  group: "A" | "B";
  radiant: { id: string; name: string };
  dire: { id: string; name: string };
  scheduledAt: Date;
  status: string;
  winnerName?: string | null;
};

function pick(matches: PlayoffMatchView[], slot: PlayoffMatchView["slotKey"]) {
  return matches.find((match) => match.slotKey === slot);
}

function Side({
  team,
  fallback,
  winnerId,
}: {
  team: { id: string; name: string } | null;
  fallback: string;
  winnerId?: string | null;
}) {
  if (!team) return <span className="pg-side pg-tbd">{fallback}</span>;
  const won = winnerId === team.id;
  return (
    <Link
      href={`/teams/${team.id}`}
      className={won ? "pg-side pg-side-won" : "pg-side"}
    >
      {team.name}
    </Link>
  );
}

function GraphNode({
  match,
  compact = false,
}: {
  match: PlayoffMatchView;
  compact?: boolean;
}) {
  const code =
    match.matchNumber != null ? `M${match.matchNumber}` : "Adv";
  return (
    <article
      className={`pg-node pg-node-${match.displayStatus}`}
      aria-label={`${match.label}, ${match.formatLabel}, ${match.displayStatus}`}
    >
      <div className="pg-node-head">
        <span>
          {code} · {match.round}
        </span>
        <span>
          {match.formatLabel}
          <span className={`pg-dot pg-dot-${match.displayStatus}`}>
            {match.displayStatus}
          </span>
        </span>
      </div>
      <Side
        team={match.radiant}
        fallback={match.leftLabel}
        winnerId={match.winner?.id}
      />
      <Side
        team={match.dire}
        fallback={match.rightLabel}
        winnerId={match.winner?.id}
      />
      {compact ? null : match.scheduledAt ? (
        <p className="pg-when">{formatScheduleWhen(match.scheduledAt)}</p>
      ) : (
        <p className="pg-when muted">{match.waitingReason}</p>
      )}
    </article>
  );
}

function GroupPath({
  title,
  group,
  matches,
}: {
  title: string;
  group: "A" | "B";
  matches: GroupGraphMatch[];
}) {
  if (matches.length === 0) return null;
  return (
    <div className="mg-group">
      <h3>{title}</h3>
      <ol className="mg-path">
        {matches.map((match, index) => {
          const done = match.status === "completed";
          return (
            <li key={match.id} className={done ? "mg-chip mg-chip-done" : "mg-chip"}>
              {index > 0 ? <span className="mg-join" aria-hidden /> : null}
              <div className="mg-chip-body">
                <span className="mg-chip-n">{group}{index + 1}</span>
                <span className="mg-chip-vs">
                  {match.radiant.name} vs {match.dire.name}
                </span>
                <span className="mg-chip-meta">
                  {done && match.winnerName
                    ? `${match.winnerName} won`
                    : formatScheduleWhen(match.scheduledAt)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function PlayoffGraph({
  view,
  groupMatches = [],
  compact = false,
}: {
  view: PlayoffView;
  groupMatches?: GroupGraphMatch[];
  compact?: boolean;
}) {
  const node = (slot: PlayoffMatchView["slotKey"]) => {
    const match = pick(view.matches, slot);
    return match ? <GraphNode match={match} compact={compact} /> : null;
  };
  const groupA = groupMatches.filter((row) => row.group === "A");
  const groupB = groupMatches.filter((row) => row.group === "B");

  return (
    <section className={compact ? "playoff-graph-wrap pg-compact" : "playoff-graph-wrap"}>
      <div className="section-head row">
        <h2>{compact ? "Match graph" : "Tournament graph"}</h2>
        <span className="muted">Winners move right · losers drop down</span>
      </div>
      {!compact && (groupA.length > 0 || groupB.length > 0) ? (
        <div className="mg-groups">
          <GroupPath title="Group A" group="A" matches={groupA} />
          <GroupPath title="Group B" group="B" matches={groupB} />
        </div>
      ) : null}
      <p className="pg-hint muted">
        Swipe sideways on a phone to follow Upper → Grand Final and the Lower
        Bracket path.
      </p>
      <div className="playoff-graph-scroll">
        <div className="playoff-graph" role="img" aria-label="Playoff bracket graph">
          <div className="pg-lane pg-lane-upper">
            <span className="pg-lane-label">Upper</span>
            <div className="pg-stack">
              {node("ub1")}
              {node("ub2")}
            </div>
            <div className="pg-fork" aria-hidden>
              <span />
            </div>
            {node("uf")}
            <div className="pg-line" aria-hidden />
            {node("final")}
          </div>
          <div className="pg-lane pg-lane-lower">
            <span className="pg-lane-label">Lower</span>
            <div className="pg-stack">
              {node("lb1")}
              {node("lb2")}
            </div>
            <div className="pg-fork" aria-hidden>
              <span />
            </div>
            {node("lb3")}
            <div className="pg-line" aria-hidden />
            {node("lb_final")}
            <div className="pg-rise" aria-hidden title="Lower Final winner to Grand Final" />
          </div>
        </div>
      </div>
      <ul className="pg-legend">
        <li><span className="pg-dot pg-dot-waiting" /> Waiting</li>
        <li><span className="pg-dot pg-dot-upcoming" /> Upcoming</li>
        <li><span className="pg-dot pg-dot-live" /> Live</li>
        <li><span className="pg-dot pg-dot-completed" /> Completed</li>
      </ul>
    </section>
  );
}
