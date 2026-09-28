"use client";

import { useState } from "react";
import {
  AdminCard,
  AdminField,
  AdminSection,
  adminControlClass,
} from "@/components/admin/ui";
import {
  AdminConfirmForm,
  AdminSubmitButton,
} from "@/components/admin/form-controls";
import {
  actionActivateSeason,
  actionCreateSeason,
  actionEndSeasonArchive,
} from "@/app/admin/actions";
import {
  ALLOWED_TEAM_COUNTS,
  SEASON_PHASE,
  TOURNAMENT_FORMAT,
  formatSeasonLabel,
} from "@/lib/seasons";

type AdminSeasonRow = {
  id: string;
  number: number;
  name: string;
  status: string;
  phase: string;
  plannedStartAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
  tournamentFormat: string;
  teamCount: number;
  championName: string | null;
  isLivePointer: boolean;
};

export function AdminSeasonsBoard({
  seasons,
  liveSeasonId,
}: {
  seasons: AdminSeasonRow[];
  liveSeasonId: string | null;
}) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="grid gap-6">
      <AdminCard tone="accent">
        <AdminSection title="Create new season">
          {!createOpen ? (
            <button
              type="button"
              className="rounded-md border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
              onClick={() => setCreateOpen(true)}
            >
              Open create modal
            </button>
          ) : (
            <AdminConfirmForm
              action={actionCreateSeason}
              message="Create this upcoming season?"
              successMessage="Season created"
              className="grid gap-3 sm:grid-cols-2"
            >
              <AdminField label="Season name" className="sm:col-span-2">
                <input
                  name="name"
                  required
                  placeholder="Season 2"
                  className={adminControlClass}
                />
              </AdminField>
              <AdminField label="Planned start date">
                <input name="plannedStartAt" type="date" className={adminControlClass} />
              </AdminField>
              <AdminField label="Tournament format">
                <select name="tournamentFormat" defaultValue={TOURNAMENT_FORMAT.AUCTION_BASED} className={adminControlClass}>
                  <option value={TOURNAMENT_FORMAT.AUCTION_BASED}>Auction-based</option>
                  <option value={TOURNAMENT_FORMAT.TEAM_BASED}>Team-based</option>
                </select>
              </AdminField>
              <AdminField label="Team count">
                <select name="teamCount" defaultValue="8" className={adminControlClass}>
                  {ALLOWED_TEAM_COUNTS.map((n) => (
                    <option key={n} value={String(n)}>
                      {n} teams
                    </option>
                  ))}
                </select>
              </AdminField>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <AdminSubmitButton>Create season</AdminSubmitButton>
                <button
                  type="button"
                  className="rounded-md border border-white/10 px-3 py-2 text-xs text-muted-foreground"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </AdminConfirmForm>
          )}
        </AdminSection>
      </AdminCard>

      <AdminCard>
        <AdminSection title="All seasons">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-muted-foreground uppercase">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Phase</th>
                  <th className="py-2 pr-3">Format</th>
                  <th className="py-2 pr-3">Teams</th>
                  <th className="py-2 pr-3">Champion</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {seasons.map((row) => (
                  <tr key={row.id} className="border-b border-white/5 align-top">
                    <td className="py-3 pr-3 font-mono">{row.number}</td>
                    <td className="py-3 pr-3">
                      <p className="m-0 font-medium">{row.name}</p>
                      <p className="m-0 text-xs text-muted-foreground">
                        {formatSeasonLabel(row)}
                      </p>
                    </td>
                    <td className="py-3 pr-3">{row.phase}</td>
                    <td className="py-3 pr-3 text-xs">{row.tournamentFormat}</td>
                    <td className="py-3 pr-3">{row.teamCount}</td>
                    <td className="py-3 pr-3">{row.championName ?? "—"}</td>
                    <td className="py-3">
                      <div className="flex flex-col gap-2">
                        {row.status !== "archived" &&
                        row.phase !== SEASON_PHASE.COMPLETED ? (
                          <>
                            {row.id !== liveSeasonId ? (
                              <AdminConfirmForm
                                action={actionActivateSeason}
                                message={`Activate ${row.name} as the live season?`}
                                successMessage="Season activated"
                              >
                                <input type="hidden" name="seasonId" value={row.id} />
                                <AdminSubmitButton variant="secondary" className="text-xs">
                                  Go live
                                </AdminSubmitButton>
                              </AdminConfirmForm>
                            ) : (
                              <span className="text-xs text-emerald-400">Live pointer</span>
                            )}
                            {row.isLivePointer || row.status === "live" ? (
                              <AdminConfirmForm
                                action={actionEndSeasonArchive}
                                message={`End and archive ${row.name}? Homepage clears; data stays in Seasons archive.`}
                                title="End season"
                                confirmLabel="End & archive"
                                successMessage="Season archived"
                              >
                                <input type="hidden" name="seasonId" value={row.id} />
                                <AdminSubmitButton
                                  variant="secondary"
                                  className="text-xs text-amber-200"
                                >
                                  End season
                                </AdminSubmitButton>
                              </AdminConfirmForm>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">Archived</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSection>
      </AdminCard>
    </div>
  );
}
