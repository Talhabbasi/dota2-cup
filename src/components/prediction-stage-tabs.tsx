"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { InternationalBracket } from "@/components/international-bracket";
import { PredictionBoard } from "@/components/prediction-board";
import { BRACKET_SLOTS, isBracketSlot } from "@/lib/playoff-tree";
import {
  pickMapFrom,
  resolvedBracketPicks,
} from "@/lib/prediction-bracket";
import type { InternationalPickemView, PredictionStageView } from "@/lib/predictions";

export function PredictionStageTabs({
  group,
  pickem,
  canPick,
}: {
  group: PredictionStageView;
  pickem: InternationalPickemView;
  canPick: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"group" | "international">(
    group.stageLocked && pickem.unlocked ? "international" : "group",
  );
  const [committed, setCommitted] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const groupOpen = tab === "group";

  const livePicks = useMemo(() => {
    const merged = { ...pickem.savedPicks, ...committed, ...drafts };
    if (!pickem.seeds) return merged;
    const slotPicks = pickMapFrom(
      resolvedBracketPicks(pickem.seeds, pickem.actual, merged),
    );
    const groupPicks: Record<string, string> = {};
    for (const [key, value] of Object.entries(merged)) {
      if (!isBracketSlot(key)) groupPicks[key] = value;
    }
    return { ...groupPicks, ...slotPicks };
  }, [pickem.savedPicks, pickem.seeds, pickem.actual, committed, drafts]);
  const groupDirty = useMemo(
    () =>
      Object.entries(drafts)
        .filter(([fixtureId]) => !isBracketSlot(fixtureId))
        .map(([fixtureId, teamId]) => ({ fixtureId, teamId })),
    [drafts],
  );
  const slotDirty = BRACKET_SLOTS.some(
    (slot) => (livePicks[slot] ?? null) !== (pickem.savedPicks[slot] ?? null),
  );
  const dirtyCount =
    groupDirty.length +
    (slotDirty
      ? BRACKET_SLOTS.filter(
          (slot) =>
            (livePicks[slot] ?? null) !== (pickem.savedPicks[slot] ?? null),
        ).length
      : 0);

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
    const snapshot = { ...livePicks };
    const slots = slotDirty
      ? BRACKET_SLOTS.flatMap((slot) => {
          const teamId = livePicks[slot];
          return teamId ? [{ slotKey: slot, teamId }] : [];
        })
      : [];
    const picks = groupDirty;
    setSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(picks.length > 0 ? { picks } : {}),
          ...(slots.length > 0 ? { slots } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save those picks.");
        return;
      }
      setCommitted((prev) => ({ ...prev, ...snapshot }));
      setDrafts({});
      setJustSaved(true);
      router.refresh();
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
          {pickem.unlocked ? (
            pickem.treeLocked ? (
              <span className="pred-tab-state">Locked</span>
            ) : null
          ) : (
            <span className="pred-tab-state">Locked</span>
          )}
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
                  : "Locks Friday 10:00 PM PKT"}
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
              {pickem.lockLabel ?? "Winners move right · losers drop down"}
            </span>
          </div>
          {pickem.unlocked ? (
            <InternationalBracket
              view={pickem}
              canPick={canPick}
              saving={saving}
              picks={livePicks}
              onPick={(slotKey, teamId) =>
                onPick(
                  slotKey,
                  teamId,
                  (isBracketSlot(slotKey)
                    ? pickem.savedPicks[slotKey]
                    : undefined) ?? null,
                )
              }
            />
          ) : (
            <div className="empty-panel teams-list-empty">
              <p className="muted" style={{ margin: 0 }}>
                Upper bracket, lower bracket, and the Grand Final stay locked
                until every group-stage match is complete. Tap the opening
                matches, then follow winners and losers through the tree.
              </p>
            </div>
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
