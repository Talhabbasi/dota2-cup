"use client";

import { useMemo } from "react";
import { pickemSlots, type PickemSlotView } from "@/lib/prediction-bracket";
import type { InternationalPickemView } from "@/lib/predictions";
import type { BracketSlot } from "@/lib/playoff-tree";

function node(slots: PickemSlotView[], slot: BracketSlot) {
  return slots.find((row) => row.slotKey === slot) ?? null;
}

function SlotNode({
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
      className={[
        "ti-node",
        match.completed ? "ti-node-done" : "",
        match.locked ? "ti-node-locked" : "",
        ready && !match.locked && !match.completed ? "ti-node-open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="ti-node-head">
        <span>
          {match.matchNumber != null ? `M${match.matchNumber}` : "M"} ·{" "}
          {match.round}
        </span>
        <span>
          {match.completed
            ? "Done"
            : match.locked
              ? "Locked"
              : `${match.points} pts`}
        </span>
      </div>
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
              "ti-side",
              selected ? "ti-side-on" : "",
              correct ? "ti-side-correct" : "",
              missed ? "ti-side-miss" : "",
              winner ? "ti-side-winner" : "",
              !team ? "ti-side-tbd" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={!canPick || match.locked || saving || !ready || !team}
            onClick={team ? () => onPick(match.slotKey, team.id) : undefined}
          >
            <span className="ti-side-name">{team?.name ?? fallback}</span>
            {selected ? (
              <span className="ti-side-mark" aria-hidden>
                ▶
              </span>
            ) : null}
          </button>
        );
      })}
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

  const card = (slot: BracketSlot) => {
    const match = node(slots, slot);
    return match ? (
      <SlotNode
        match={match}
        canPick={canPick}
        saving={saving}
        onPick={onPick}
      />
    ) : null;
  };

  return (
    <div className="playoff-graph-wrap ti-pickem-wrap">
      <p className="pg-hint muted">
        Tap a winner to send them forward — same as Dota 2 Pick’em. Winners
        move right. Losers drop to Lower. Later matches fill in as you pick.
      </p>
      <div className="playoff-graph-scroll">
        <div
          className="playoff-graph ti-pickem"
          role="img"
          aria-label="International pick’em bracket"
        >
          <div className="ti-pickem-lanes">
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
            </div>
          </div>
          <div className="ti-gf">{card("final")}</div>
        </div>
      </div>
    </div>
  );
}
