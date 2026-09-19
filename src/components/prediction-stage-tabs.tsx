"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [committed, setCommitted] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const groupOpen = tab === "group";

  const dirtyPicks = useMemo(
    () =>
      Object.entries(drafts).map(([fixtureId, teamId]) => ({
        fixtureId,
        teamId,
      })),
    [drafts],
  );
  const dirtyCount = dirtyPicks.length;

  useEffect(() => {
    if (dirtyCount === 0) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirtyCount]);

  function pickId(fixtureId: string, savedPickId: string | null) {
    return drafts[fixtureId] ?? committed[fixtureId] ?? savedPickId;
  }

  function onPick(
    fixtureId: string,
    teamId: string,
    savedPickId: string | null,
  ) {
    if (!canPick || saving) return;
    const baseline = committed[fixtureId] ?? savedPickId;
    setJustSaved(false);
    setError(null);
    setDrafts((prev) => {
      const next = { ...prev };
      if (teamId === baseline) {
        delete next[fixtureId];
      } else {
        next[fixtureId] = teamId;
      }
      return next;
    });
  }

  async function savePicks() {
    if (!canPick || dirtyCount === 0 || saving) return;
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks: dirtyPicks }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save those picks.");
        return;
      }
      setCommitted((prev) => ({ ...prev, ...drafts }));
      setDrafts({});
      setJustSaved(true);
    } catch {
      setError("Could not save those picks.");
    } finally {
      setSaving(false);
    }
  }

  const boardProps = {
    canPick,
    pickId,
    saving,
    onPick,
  };

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
          className={!groupOpen ? "pred-tab pred-tab-on" : "pred-tab"}
          onClick={() => setTab("international")}
        >
          The International
          {international.stageLocked ? (
            <span className="pred-tab-state">Locked</span>
          ) : null}
        </button>
      </div>

      {error ? <p className="pred-error">{error}</p> : null}

      {groupOpen ? (
        <section className="pred-section">
          <div className="section-head row">
            <h2>Group stage</h2>
            <span className="muted">
              {group.stageLocked
                ? "Locked for everyone"
                : group.lockLabel
                  ? `Locks ${group.lockLabel}`
                  : "Locks Saturday 10:45 PM PKT"}
            </span>
          </div>
          <PredictionBoard
            {...boardProps}
            nights={group.nights}
            stageLocked={group.stageLocked}
            emptyText="No group-stage matches are booked yet. Picks open as soon as the Saturday/Sunday grid is up."
            lockedNote="Group stage locked · no pick"
            openHint="Tap a team, then Save predictions"
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
              {...boardProps}
              nights={international.nights}
              stageLocked={false}
              emptyText="Playoff matches appear here when the bracket is booked."
              lockedNote="This series is locked"
              openHint="Tap a team, then Save predictions"
            />
          )}
        </section>
      )}

      {canPick && (dirtyCount > 0 || saving || justSaved) ? (
        <div className="pred-save-bar" role="status" aria-live="polite">
          <p className="pred-save-copy">
            {saving
              ? "Saving your picks…"
              : justSaved
                ? "Predictions saved."
                : `${dirtyCount} pick${dirtyCount === 1 ? "" : "s"} ready`}
          </p>
          <button
            type="button"
            className="btn btn-gold pred-save-btn"
            disabled={saving || dirtyCount === 0}
            onClick={() => void savePicks()}
          >
            {saving ? <span className="pred-save-spinner" aria-hidden /> : null}
            {saving ? "Saving…" : "Save predictions"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
