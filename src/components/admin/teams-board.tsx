"use client";

import { useState } from "react";
import { AdminDataTable } from "@/components/admin/master-detail";
import {
  AdminField,
  adminActionToggleClass,
  adminCardClass,
  adminControlClass,
} from "@/components/admin/ui";
import { actionAddCaptain, actionCreateManualTeam } from "@/app/admin/actions";
import {
  AdminActionForm,
  AdminSubmitButton,
} from "@/components/admin/form-controls";
import { formatPoints } from "@/lib/constants";
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
  unsigned: { discordId: string; steamName: string }[];
  allPlayers: { discordId: string; steamName: string; teamName: string | null }[];
  readOnly?: boolean;
  publicSeasonParam?: string;
  rosterMin?: number;
  rosterMax?: number;
}) {
  const [showCreate, setShowCreate] = useState(false);

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
              Name a team and assign an unsigned captain.
            </span>
          </span>
          <span className="text-primary">{showCreate ? "−" : "+"}</span>
        </button>
        {showCreate ? (
          <div className="mt-4 grid gap-6 border-t border-white/10 pt-4">
            <AdminActionForm
              action={actionAddCaptain}
              successMessage="Team created"
              className="grid gap-3 sm:grid-cols-3"
            >
              <AdminField label="Team name (auction)">
                <input name="teamName" required className={adminControlClass} />
              </AdminField>
              <AdminField label="Captain">
                <select name="discordId" required className={adminControlClass}>
                  <option value="">Unsigned player…</option>
                  {unsigned.map((p) => (
                    <option key={p.discordId} value={p.discordId}>
                      {p.steamName}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminSubmitButton className="self-end">
                Create (auction purse)
              </AdminSubmitButton>
            </AdminActionForm>

            <AdminActionForm
              action={actionCreateManualTeam}
              successMessage="Team-based franchise created"
              className="grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <AdminField label="Team name (team-based)">
                <input name="name" required className={adminControlClass} />
              </AdminField>
              <AdminField label="Tag">
                <input name="tag" placeholder="TOJI" className={adminControlClass} />
              </AdminField>
              <AdminField label="Logo URL">
                <input name="logoUrl" placeholder="https://…" className={adminControlClass} />
              </AdminField>
              <AdminField label="Captain">
                <select name="captainDiscordId" required className={adminControlClass}>
                  <option value="">Player…</option>
                  {unsigned.map((p) => (
                    <option key={p.discordId} value={p.discordId}>
                      {p.steamName}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Starting purse">
                <input
                  name="purse"
                  type="number"
                  defaultValue={0}
                  className={adminControlClass}
                />
              </AdminField>
              <AdminSubmitButton className="self-end">
                Create (manual roster)
              </AdminSubmitButton>
            </AdminActionForm>
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
