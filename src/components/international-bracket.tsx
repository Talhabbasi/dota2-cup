"use client";

import { useMemo } from "react";
import { pickemSlots, type PickemSlotView } from "@/lib/prediction-bracket";
import type { InternationalPickemView } from "@/lib/predictions";
import type { BracketSlot } from "@/lib/playoff-tree";

const LANE_GROUPS: {
  label: string;
  note: string;
  slots: BracketSlot[];
}[] = [
  {
    label: "Upper bracket",
    note: "10 pts each",
    slots: ["ub1", "ub2", "uf"],
  },
  {
    label: "Lower bracket",
    note: "10 pts each",
    slots: ["lb1", "lb2", "lb3", "lb_final"],
  },
  {
    label: "Grand Final",
    note: "50 pts",
    slots: ["final"],
  },
];

function node(slots: PickemSlotView[], slot: BracketSlot) {
  return slots.find((row) => row.slotKey === slot) ?? null;
}

function cardNote(match: PickemSlotView, canPick: boolean) {
  const ready = Boolean(match.left && match.right);
  if (match.completed) {
    if (!match.myPickId) return "No pick";
    if (match.myPickId === match.winnerTeamId) {
      return `Correct · +${match.points}`;
    }
    return "Missed";
  }
  if (match.locked) {
    return match.myPickId ? "Locked in" : "Locked · no pick";
  }
  if (!ready) return match.waiting;
  if (!canPick) return "";
  return match.myPickId
    ? "Picked · save when you are done"
    : "Tap a team, then Save predictions";
}

function SlotCard({
  match,
  canPick,
  saving,
  onPick,
}: {
  match: PickemSlotView;
  canPick: boolean;
  saving: boolean;
  onPick: (slotKey: string, teamId: string) => void;
}) {
  const ready = Boolean(match.left && match.right);
  const series = `BO${match.bestOf}`;
  return (
    <article className="weekend-card pred-card">
      <div className="weekend-card-head">
        <span className="weekend-day">
          {match.matchNumber != null ? `M${match.matchNumber} · ` : ""}
          {match.round}
        </span>
        <span
          className={
            match.completed
              ? "weekend-status weekend-status-won"
              : match.locked
                ? "weekend-status"
                : "weekend-status weekend-status-next"
          }
        >
          {match.completed
            ? "Done"
            : match.locked
              ? "Locked"
              : `${match.points} pts`}
        </span>
      </div>
      <p className="weekend-pkt">
        {series} · Winner to {match.winnerGoes} · Loser to {match.loserGoes}
      </p>
      <div className="pred-picks">
        {([match.left, match.right] as const).map((team, index) => {
          const fallback = index === 0 ? match.leftLabel : match.rightLabel;
          const selected = Boolean(team && match.myPickId === team.id);
          const correct =
            match.completed && selected && match.winnerTeamId === team?.id;
          const missed =
            match.completed && selected && match.winnerTeamId !== team?.id;
          const winner = match.completed && match.winnerTeamId === team?.id;
          return (
            <button
              key={team?.id ?? fallback}
              type="button"
              className={[
                "pred-pick",
                selected ? "pred-pick-on" : "",
                correct ? "pred-pick-correct" : "",
                missed ? "pred-pick-miss" : "",
                winner ? "pred-pick-winner" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={!canPick || match.locked || saving || !ready || !team}
              onClick={
                team ? () => onPick(match.slotKey, team.id) : undefined
              }
            >
              {team?.name ?? fallback}
            </button>
          );
        })}
      </div>
      <p className="pred-card-note">{cardNote(match, canPick)}</p>
    </article>
  );
}

export function InternationalBracket({
  view,
  canPick,
  saving,
  picks,
  onPick,
}: {
  view: InternationalPickemView;
  canPick: boolean;
  saving: boolean;
  picks: Partial<Record<string, string>>;
  onPick: (slotKey: string, teamId: string) => void;
}) {
  const slots = useMemo(() => {
    if (!view.seeds) return view.slots;
    return pickemSlots(
      view.seeds,
      view.actual,
      picks as Partial<Record<BracketSlot, string>>,
      new Set(view.lockedSlots),
      view.treeLocked,
    );
  }, [view, picks]);

  if (!view.unlocked) {
    return (
      <div className="empty-panel teams-list-empty">
        <p className="muted" style={{ margin: 0 }}>
          {view.lockLabel}
        </p>
      </div>
    );
  }

  return (
    <div className="pred-board">
      {LANE_GROUPS.map((lane) => {
        const matches = lane.slots
          .map((slot) => node(slots, slot))
          .filter((row): row is PickemSlotView => Boolean(row));
        if (matches.length === 0) return null;
        return (
          <section key={lane.label} className="weekend-schedule">
            <div className="weekend-board">
              <div className="section-head row">
                <h2>{lane.label}</h2>
                <span className="muted">{lane.note}</span>
              </div>
              <div className="weekend-grid schedule-grid pred-grid">
                {matches.map((match) => (
                  <SlotCard
                    key={match.slotKey}
                    match={match}
                    canPick={canPick}
                    saving={saving}
                    onPick={onPick}
                  />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
