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
  actionDeleteSeason,
  actionEndSeasonArchive,
  actionUpdateSeason,
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
  plannedStartAt: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  tournamentFormat: string;
  teamCount: number;
  championName: string | null;
  isActive: boolean;
  isLivePointer: boolean;
  hasData: boolean;
};

function SeasonEditForm({ row }: { row: AdminSeasonRow }) {
  return (
    <AdminConfirmForm
      action={actionUpdateSeason}
      message={`Save changes to ${row.name}?`}
      successMessage="Season updated"
      className="grid gap-2 rounded-md border border-white/10 bg-black/20 p-3 sm:grid-cols-2"
    >
      <input type="hidden" name="seasonId" value={row.id} />
      <AdminField label="Name" className="sm:col-span-2">
        <input
          name="name"
          required
          defaultValue={row.name}
          className={adminControlClass}
        />
      </AdminField>
      <AdminField label="Planned start">
        <input
          name="plannedStartAt"
          type="date"
          defaultValue={row.plannedStartAt ?? ""}
          className={adminControlClass}
        />
      </AdminField>
      <AdminField label="Format">
        <select
          name="tournamentFormat"
          defaultValue={row.tournamentFormat}
          className={adminControlClass}
        >
          <option value={TOURNAMENT_FORMAT.AUCTION_BASED}>Auction-based</option>
          <option value={TOURNAMENT_FORMAT.TEAM_BASED}>Team-based</option>
        </select>
      </AdminField>
      <AdminField label="Team count">
        <select
          name="teamCount"
          defaultValue={String(row.teamCount)}
          className={adminControlClass}
        >
          {ALLOWED_TEAM_COUNTS.map((n) => (
            <option key={n} value={String(n)}>
              {n} teams
            </option>
          ))}
        </select>
      </AdminField>
      <div className="sm:col-span-2">
        <AdminSubmitButton className="text-xs">Save edits</AdminSubmitButton>
      </div>
    </AdminConfirmForm>
  );
}

export function AdminSeasonsBoard({
  seasons,
  liveSeasonId,
}: {
  seasons: AdminSeasonRow[];
  liveSeasonId: string | null;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
              Open create form
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
                <select
                  name="tournamentFormat"
                  defaultValue={TOURNAMENT_FORMAT.AUCTION_BASED}
                  className={adminControlClass}
                >
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
          <p className="mb-3 text-xs text-muted-foreground">
            Full CRUD: create, edit, set active, end &amp; archive, delete.
            Only one season can be <strong className="text-foreground">Active</strong>.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-muted-foreground uppercase">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Active</th>
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
                      {editingId === row.id ? (
                        <div className="mt-3">
                          <SeasonEditForm row={row} />
                          <button
                            type="button"
                            className="mt-2 text-xs text-muted-foreground underline"
                            onClick={() => setEditingId(null)}
                          >
                            Close edit
                          </button>
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3">
                      {row.isActive ? (
                        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide text-emerald-300 uppercase">
                          Active
                        </span>
                      ) : (
                        <AdminConfirmForm
                          action={actionActivateSeason}
                          message={`Set ${row.name} as the active season? Homepage, predictions, and live boards will switch immediately.`}
                          successMessage="Active season updated"
                        >
                          <input type="hidden" name="seasonId" value={row.id} />
                          <AdminSubmitButton variant="secondary" className="text-xs">
                            Set active
                          </AdminSubmitButton>
                        </AdminConfirmForm>
                      )}
                    </td>
                    <td className="py-3 pr-3">{row.phase}</td>
                    <td className="py-3 pr-3 text-xs">{row.tournamentFormat}</td>
                    <td className="py-3 pr-3">{row.teamCount}</td>
                    <td className="py-3 pr-3">{row.championName ?? "—"}</td>
                    <td className="py-3">
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          className="rounded-md border border-white/15 px-2 py-1 text-xs hover:bg-white/5"
                          onClick={() =>
                            setEditingId((id) => (id === row.id ? null : row.id))
                          }
                        >
                          {editingId === row.id ? "Hide edit" : "Edit"}
                        </button>

                        {row.status !== "archived" &&
                        row.phase !== SEASON_PHASE.COMPLETED ? (
                          (row.isActive ||
                            row.isLivePointer ||
                            row.id === liveSeasonId ||
                            row.status === "live") && (
                            <AdminConfirmForm
                              action={actionEndSeasonArchive}
                              message={`End and archive ${row.name}? Clears active pointer; data stays in Seasons archive.`}
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
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">Archived</span>
                        )}

                        <AdminConfirmForm
                          action={actionDeleteSeason}
                          message={
                            row.hasData
                              ? `FORCE delete ${row.name}? This wipes season teams/rosters for this season. Matches are detached. This cannot be undone.`
                              : `Delete ${row.name}? This cannot be undone.`
                          }
                          title="Delete season"
                          confirmLabel={row.hasData ? "Force delete" : "Delete"}
                          successMessage="Season deleted"
                        >
                          <input type="hidden" name="seasonId" value={row.id} />
                          {row.hasData ? (
                            <input type="hidden" name="force" value="1" />
                          ) : null}
                          <AdminSubmitButton
                            variant="secondary"
                            className="text-xs text-rose-300"
                          >
                            {row.hasData ? "Force delete" : "Delete"}
                          </AdminSubmitButton>
                        </AdminConfirmForm>
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
