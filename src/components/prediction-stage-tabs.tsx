"use client";

import { useState } from "react";
import { PredictionBoard } from "@/components/prediction-board";
import type { PredictionStageView } from "@/lib/predictions";

export function PredictionStageTabs({
  group,
  international,
  canPick,
}: {
  group: PredictionStageView;
  international: PredictionStageView;
  canPick: boolean;
}) {
  const [tab, setTab] = useState<"group" | "international">("group");
  const groupOpen = tab === "group";

  return (
    <div className="pred-stages">
      <div className="pred-tabs" role="tablist" aria-label="Prediction stages">
        <button
          type="button"
          role="tab"
          aria-selected={groupOpen}
          className={groupOpen ? "pred-tab pred-tab-on" : "pred-tab"}
          onClick={() => setTab("group")}
        >
          Group stage
          {group.stageLocked ? (
            <span className="pred-tab-state">Locked</span>
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!groupOpen}
          className={
            !groupOpen ? "pred-tab pred-tab-on" : "pred-tab"
          }
          onClick={() => setTab("international")}
        >
          The International
          {international.stageLocked ? (
            <span className="pred-tab-state">Locked</span>
          ) : null}
        </button>
      </div>

      {groupOpen ? (
        <section className="pred-section">
          <div className="section-head row">
            <h2>Group stage</h2>
            <span className="muted">
              {group.stageLocked
                ? "Locked for everyone"
                : group.lockLabel
                  ? `Locks ${group.lockLabel}`
                  : "Locks Saturday 10:00 PM PKT"}
            </span>
          </div>
          <PredictionBoard
            nights={group.nights}
            canPick={canPick}
            stageLocked={group.stageLocked}
            lockLabel={group.lockLabel}
            emptyText="No group-stage matches are booked yet. Picks open as soon as the Saturday/Sunday grid is up."
            lockedNote="Group stage locked · no pick"
            openHint={
              group.lockLabel
                ? `Tap a team before ${group.lockLabel}`
                : "Tap a team before Saturday 10:00 PM PKT"
            }
          />
        </section>
      ) : (
        <section className="pred-section">
          <div className="section-head row">
            <h2>The International</h2>
            <span className="muted">
              {international.stageLocked
                ? international.lockLabel
                : "Upper · lower · grand final"}
            </span>
          </div>
          {international.stageLocked ? (
            <div className="empty-panel teams-list-empty">
              <p className="muted" style={{ margin: 0 }}>
                Upper bracket, lower bracket, and the Grand Final stay locked
                until every group-stage match is complete. Points from this
                stage still add to the same board.
              </p>
            </div>
          ) : (
            <PredictionBoard
              nights={international.nights}
              canPick={canPick}
              stageLocked={false}
              lockLabel={null}
              emptyText="Playoff matches appear here when the bracket is booked."
              lockedNote="This series is locked"
              openHint="Tap a team before this series starts"
            />
          )}
        </section>
      )}
    </div>
  );
}
