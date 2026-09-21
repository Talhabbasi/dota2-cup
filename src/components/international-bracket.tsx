"use client";

import { useMemo } from "react";
import { pickemSlots, type PickemSlotView } from "@/lib/prediction-bracket";
import type { InternationalPickemView } from "@/lib/predictions";
import type { BracketSlot } from "@/lib/playoff-tree";

function node(slots: PickemSlotView[], slot: BracketSlot) {
  return slots.find((row) => row.slotKey === slot) ?? null;
}

function PickButton({
  team,
  fallback,
  selected,
  correct,
  missed,
  winner,
  disabled,
  onPick,
}: {
  team: { id: string; name: string } | null;
  fallback: string;
  selected: boolean;
  correct: boolean;
  missed: boolean;
  winner: boolean;
  disabled: boolean;
  onPick?: () => void;
}) {
  return (
    <button
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
      disabled={disabled || !team}
      onClick={onPick}
    >
      {team?.name ?? fallback}
    </button>
  );
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
  return (
    <article
      className={`pg-node pg-node-${match.completed ? "completed" : match.locked ? "waiting" : "upcoming"} ti-slot`}
    >
      <div className="pg-node-head">
        <span>
          {match.matchNumber != null ? `M${match.matchNumber}` : "M"} · {match.round}
        </span>
        <span>{match.completed ? "Done" : match.locked ? "Locked" : `${match.points} pts`}</span>
      </div>
      <p className="ti-slot-note muted">
        Winner → {match.winnerGoes} · Loser → {match.loserGoes}
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
            <PickButton
              key={team?.id ?? fallback}
              team={team}
              fallback={fallback}
              selected={selected}
              correct={correct}
              missed={missed}
              winner={Boolean(winner)}
              disabled={!canPick || match.locked || saving || !ready}
              onPick={
                team ? () => onPick(match.slotKey, team.id) : undefined
              }
            />
          );
        })}
      </div>
      {!ready ? <p className="pg-when muted">{match.waiting}</p> : null}
    </article>
  );
}

export function InternationalBracket({
  view,
  canPick,
  saving,
  drafts,
  onPick,
}: {
  view: InternationalPickemView;
  canPick: boolean;
  saving: boolean;
  drafts: Record<string, string>;
  onPick: (slotKey: string, teamId: string) => void;
}) {
  const slots = useMemo(() => {
    if (!view.seeds) return view.slots;
    const picks = { ...view.savedPicks, ...drafts };
    return pickemSlots(
      view.seeds,
      view.actual,
      picks,
      new Set(view.lockedSlots),
      view.treeLocked,
    );
  }, [view, drafts]);

  if (!view.unlocked) {
    return (
      <div className="empty-panel teams-list-empty">
        <p className="muted" style={{ margin: 0 }}>
          {view.lockLabel}
        </p>
      </div>
    );
  }

  const card = (slot: BracketSlot) => {
    const match = node(slots, slot);
    return match ? (
      <SlotCard
        match={match}
        canPick={canPick}
        saving={saving}
        onPick={onPick}
      />
    ) : null;
  };

  return (
    <div className="playoff-graph-scroll">
      <div className="playoff-graph ti-pickem" role="img" aria-label="International prediction bracket">
        <div className="pg-lane pg-lane-upper">
          <span className="pg-lane-label">Upper</span>
          <div className="pg-stack">
            {card("ub1")}
            {card("ub2")}
          </div>
          <div className="pg-fork" aria-hidden>
            <span />
          </div>
          {card("uf")}
          <div className="pg-line" aria-hidden />
          {card("final")}
        </div>
        <div className="pg-lane pg-lane-lower">
          <span className="pg-lane-label">Lower</span>
          <div className="pg-stack">
            {card("lb1")}
            {card("lb2")}
          </div>
          <div className="pg-fork" aria-hidden>
            <span />
          </div>
          {card("lb3")}
          <div className="pg-line" aria-hidden />
          {card("lb_final")}
          <div className="pg-rise" aria-hidden />
        </div>
      </div>
    </div>
  );
}
