"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  actionAutoAssignCommit,
  actionAutoAssignPreview,
} from "@/app/admin/actions";
import {
  adminBtnPrimaryClass,
  adminBtnSecondaryClass,
} from "@/components/admin/ui";
import type {
  AutoAssignOverview,
  AutoAssignProposal,
} from "@/lib/auto-assign";
import { cn } from "@/lib/utils";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <p className="m-0 text-[0.65rem] tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="m-0 mt-1 font-mono text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function AutoAssignPanel({ overview }: { overview: AutoAssignOverview }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<AutoAssignProposal | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const locked = Boolean(overview.disabledReason);

  function generate() {
    setError(null);
    setSaved(null);
    const seed = Math.floor(Math.random() * 1_000_000_000) + 1;
    startTransition(async () => {
      const result = await actionAutoAssignPreview(seed);
      if (!result.ok) {
        setProposal(null);
        setError(result.error);
        return;
      }
      setProposal(result.proposal);
    });
  }

  function confirm() {
    if (!proposal || proposal.assignments.length === 0) return;
    const ok = window.confirm(
      `Assign ${proposal.assignments.length} paid players to teams? Auctioned players stay where they are.`,
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await actionAutoAssignCommit(
        proposal.assignments.map((row) => ({
          playerId: row.playerId,
          teamId: row.teamId,
        })),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setProposal(null);
      setSaved(`Assigned ${result.count} players. Rosters and Discord roles are updating.`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <p className="m-0 text-sm text-muted-foreground">
        Fills open starter slots up to 5 using the medal ladder. Immortal is 8
        and each medal below is one step lower. Uncalibrated is 0. Unpaid
        players are left out. It does not change a live or paused auction,
        bids, purses, or players who were already sold.
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Unpicked" value={overview.unpicked} />
        <Stat label="Eligible paid" value={overview.eligible} />
        <Stat label="Unpaid excluded" value={overview.unpaidExcluded} />
        <Stat label="Teams under 5" value={overview.shortTeams} />
        <Stat label="Open slots" value={overview.openSlots} />
      </div>
      {overview.invalidRankExcluded > 0 ? (
        <p className="m-0 text-sm text-amber-200">
          {overview.invalidRankExcluded} paid unpicked{" "}
          {overview.invalidRankExcluded === 1 ? "player has" : "players have"} no
          valid rank and {overview.invalidRankExcluded === 1 ? "is" : "are"} excluded.
        </p>
      ) : null}
      {overview.disabledReason ? (
        <p className="m-0 text-sm text-amber-200">{overview.disabledReason}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(adminBtnPrimaryClass, "px-4 py-2")}
          disabled={locked || pending}
          onClick={generate}
        >
          {pending && !proposal ? "Building…" : "Auto Assign Remaining Players"}
        </button>
        {proposal ? (
          <button
            type="button"
            className={cn(adminBtnSecondaryClass, "px-4 py-2")}
            disabled={pending}
            onClick={generate}
          >
            {pending ? "Building…" : "Regenerate Assignment"}
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="m-0 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="m-0 text-sm text-emerald-300" role="status">
          {saved}
        </p>
      ) : null}
      {proposal ? (
        <div className="grid gap-3">
          <p className="m-0 text-sm text-muted-foreground">
            {proposal.assignments.length} players proposed. Team rank spread{" "}
            <span className="font-mono text-foreground">{proposal.spread}</span>.
            Review this draw, regenerate for another balanced one, then confirm.
          </p>
          {proposal.assignments.length === 0 ? (
            <p className="m-0 text-sm text-muted-foreground">
              This draw did not place anyone.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="bg-white/[0.03] text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Player</th>
                    <th className="px-3 py-2 font-semibold">Rank</th>
                    <th className="px-3 py-2 font-semibold">Team</th>
                    <th className="px-3 py-2 font-semibold">Roster</th>
                    <th className="px-3 py-2 font-semibold">Avg rank</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.assignments.map((row) => (
                    <tr key={row.playerId} className="border-t border-white/8">
                      <td className="px-3 py-2 font-medium">{row.playerName}</td>
                      <td className="px-3 py-2">
                        {row.medal}{" "}
                        <span className="font-mono text-xs text-muted-foreground">
                          {row.rankScore}
                        </span>
                      </td>
                      <td className="px-3 py-2">{row.teamName}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.beforeCount} → {row.afterCount}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.beforeAverage ?? "—"} → {row.afterAverage ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {proposal.leftOut.length > 0 ? (
            <p className="m-0 text-sm text-muted-foreground">
              Not placed ({proposal.leftOut.length}):{" "}
              {proposal.leftOut.map((player) => player.playerName).join(", ")}.
              Slots ran out before these paid players.
            </p>
          ) : null}
          <button
            type="button"
            className={cn(adminBtnPrimaryClass, "w-fit px-4 py-2")}
            disabled={pending || proposal.assignments.length === 0}
            onClick={confirm}
          >
            {pending ? "Saving…" : "Confirm assignment"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
