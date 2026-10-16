"use client";

import { useState } from "react";
import { AdminDataTable } from "@/components/admin/master-detail";
import {
  AdminField,
  adminActionToggleClass,
  adminCardClass,
  adminControlClass,
} from "@/components/admin/ui";
import { actionCreateManualTeam } from "@/app/admin/actions";
import {
  AdminActionForm,
  AdminSubmitButton,
} from "@/components/admin/form-controls";
import { STARTING_PURSE, formatPoints } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type AdminTeamRow = {
  id: string;
  name: string;
  tag: string | null;
  purse: number;
  captainName: string | null;
  playerCount: number;
};

export function AdminTeamsBoard({
  teams,
  unsigned,
  readOnly = false,
  publicSeasonParam,
  rosterMin = 5,
  rosterMax = 7,
}: {
  teams: AdminTeamRow[];
  unsigned: { id: string; discordId: string; steamName: string; medal?: string | null }[];
  allPlayers: { discordId: string; steamName: string; teamName: string | null }[];
  readOnly?: boolean;
  publicSeasonParam?: string;
  rosterMin?: number;
  rosterMax?: number;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="space-y-6">
      {!readOnly ? (
      <div
        className={cn(
          adminCardClass,
          !showCreate &&
            "transition hover:border-[#487fff]/35 hover:bg-[#161e2e]",
        )}
      >
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className={adminActionToggleClass}
          aria-expanded={showCreate}
        >
          <span>
            <span className="block text-sm font-semibold text-foreground">
              New franchise
            </span>
            <span className="text-sm text-muted-foreground">
              Assign a captain — purse is set from their rank (Immortal 20k → Herald 27k).
            </span>
          </span>
          <span className="text-primary">{showCreate ? "−" : "+"}</span>
        </button>
        {showCreate ? (
          <div className="mt-4 border-t border-white/10 pt-4">
            {unsigned.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No unsigned players in this season. Register players first, then
                pick one as captain.
              </p>
            ) : (
              <AdminActionForm
                key={formKey}
                action={actionCreateManualTeam}
                successMessage="Franchise created — purse set from captain rank"
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                onResult={() => setFormKey((k) => k + 1)}
              >
                <AdminField label="Team name">
                  <input
                    name="name"
                    required
                    autoComplete="off"
                    placeholder="Franchise name"
                    className={adminControlClass}
                  />
                </AdminField>
                <AdminField label="Tag">
                  <input
                    name="tag"
                    placeholder="e.g. TOJI"
                    className={adminControlClass}
                  />
                </AdminField>
                <AdminField label="Logo URL">
                  <input
                    name="logoUrl"
                    placeholder="https://…"
                    className={adminControlClass}
                  />
                </AdminField>
                <AdminField label="Captain">
                  <select
                    name="captainPlayerId"
                    required
                    className={adminControlClass}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Unsigned player…
                    </option>
                    {unsigned.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.steamName}
                        {p.medal ? ` · ${p.medal}` : ""}
                      </option>
                    ))}
                  </select>
                </AdminField>
                <p className="self-end text-xs text-muted-foreground sm:col-span-2 lg:col-span-1">
                  Purse auto-fills from the captain’s registered medal. Baseline
                  is {formatPoints(STARTING_PURSE)}; lower ranks get more.
                </p>
                <AdminSubmitButton className="self-end" pendingLabel="Creating…">
                  Create franchise
                </AdminSubmitButton>
              </AdminActionForm>
            )}
          </div>
        ) : null}
      </div>
      ) : null}

      <AdminDataTable
        title={readOnly ? "Archive franchises" : "Teams"}
        hint={
          readOnly
            ? "Read-only. Click a franchise to see this season's roster."
            : "Click a franchise to open its admin page."
        }
        items={teams}
        getId={(t) => t.id}
        hrefFor={(t) => `/admin/teams/${t.id}?season=${publicSeasonParam ?? ""}`}
        searchPlaceholder="Search team or captain…"
        searchText={(t) => `${t.name} ${t.tag ?? ""} ${t.captainName ?? ""}`}
        emptyLabel="No teams this season."
        filters={[
          {
            key: "roster",
            label: "Roster",
            options: [
              { value: "short", label: `Under ${rosterMin}` },
              {
                value: "full",
                label: rosterMax === rosterMin ? `Full (${rosterMax})` : `${rosterMin}+`,
              },
              ...(rosterMax === rosterMin
                ? []
                : [{ value: "max", label: `Full (${rosterMax})` }]),
            ],
            match: (t, value) => {
              if (value === "short") return t.playerCount < rosterMin;
              if (value === "full") return t.playerCount >= rosterMin;
              if (value === "max") return t.playerCount >= rosterMax;
              return true;
            },
          },
          {
            key: "purse",
            label: "Purse",
            options: [
              { value: "high", label: "10k+" },
              { value: "mid", label: "5k–10k" },
              { value: "low", label: "Under 5k" },
            ],
            match: (t, value) => {
              if (value === "high") return t.purse >= 10_000;
              if (value === "mid") return t.purse >= 5_000 && t.purse < 10_000;
              if (value === "low") return t.purse < 5_000;
              return true;
            },
          },
        ]}
        columns={[
          {
            key: "name",
            header: "Franchise",
            cell: (t) => (
              <span className="font-medium">
                {t.name}
                {t.tag ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    [{t.tag}]
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            key: "captain",
            header: "Captain",
            cell: (t) => t.captainName ?? "—",
          },
          {
            key: "roster",
            header: "Roster",
            cell: (t) => `${t.playerCount}`,
          },
          {
            key: "purse",
            header: "Purse",
            cell: (t) => (
              <span className="tabular-nums">{formatPoints(t.purse)}</span>
            ),
          },
        ]}
      />
    </div>
  );
}
