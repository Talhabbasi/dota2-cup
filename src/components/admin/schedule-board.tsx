"use client";

import { useState } from "react";
import { AdminDataTable } from "@/components/admin/master-detail";
import {
  AdminField,
  AdminStatus,
  adminActionToggleClass,
  adminCardClass,
  adminControlClass,
} from "@/components/admin/ui";
import { actionCreateFixture, actionSchedulePubgLobby } from "@/app/admin/actions";
import { PUBG_MAPS } from "@/lib/games";
import {
  AdminActionForm,
  AdminSubmitButton,
} from "@/components/admin/form-controls";
import { cn } from "@/lib/utils";

const TIMES = [
  "22",
  "23",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
];

export type AdminFixtureRow = {
  id: string;
  when: string;
  teamA: string;
  teamB: string;
  kind: string;
  status: string;
};

export type AdminLobbyRow = {
  id: string;
  when: string;
  label: string;
  map: string;
  teamNames: string[];
};

export function AdminScheduleBoard({
  fixtures,
  teams,
  readOnly = false,
  publicSeasonParam,
  game = "DOTA",
  seasonId,
  lobbies = [],
}: {
  fixtures: AdminFixtureRow[];
  teams: { id: string; name: string }[];
  readOnly?: boolean;
  publicSeasonParam?: string;
  game?: string;
  seasonId: string;
  lobbies?: AdminLobbyRow[];
}) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-6">
      {!readOnly && game !== "PUBG" ? (
      <div
        className={cn(
          adminCardClass,
          !showAdd &&
            "transition hover:border-[#487fff]/35 hover:bg-[#161e2e]",
        )}
      >
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className={adminActionToggleClass}
          aria-expanded={showAdd}
        >
          <span>
            <span className="block text-sm font-semibold text-foreground">
              Book fixture
            </span>
            <span className="text-sm text-muted-foreground">
              Group 10pm–6am PKT · Playoffs 10am–3am PKT.
            </span>
          </span>
          <span className="text-primary">{showAdd ? "−" : "+"}</span>
        </button>
        {showAdd ? (
          <AdminActionForm
            action={actionCreateFixture}
            successMessage="Fixture booked"
            className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <input type="hidden" name="seasonId" value={seasonId} />
            <AdminField label="Team A">
              <select name="teamA" required className={adminControlClass}>
                <option value="">…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Team B">
              <select name="teamB" required className={adminControlClass}>
                <option value="">…</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Date">
              <input
                name="date"
                type="date"
                required
                className={adminControlClass}
              />
            </AdminField>
            <AdminField label="Hour PKT">
              <select
                name="time"
                required
                defaultValue="22"
                className={adminControlClass}
              >
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {t}:00
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Kind">
              <select
                name="kind"
                defaultValue="group"
                className={adminControlClass}
              >
                <option value="group">Group (Bo1)</option>
                <option value="ub">Upper bracket (Bo1)</option>
                <option value="lb">Lower bracket (Bo1)</option>
                <option value="ub_final">Upper Final (Bo1)</option>
                <option value="lb_final">Lower Final (Bo1)</option>
                <option value="final">Grand Final (Bo3)</option>
              </select>
            </AdminField>
            <AdminField label="Best of">
              <select
                name="bestOf"
                defaultValue=""
                className={adminControlClass}
              >
                <option value="">Auto (Final = Bo3)</option>
                <option value="1">Bo1</option>
                <option value="3">Bo3</option>
              </select>
            </AdminField>
            <AdminSubmitButton className="sm:col-span-2 lg:col-span-3">
              Book match
            </AdminSubmitButton>
          </AdminActionForm>
        ) : null}
      </div>
      ) : null}

      {!readOnly && game === "PUBG" ? (
        <div className={cn(adminCardClass, !showAdd && "transition hover:border-[#487fff]/35 hover:bg-[#161e2e]")}>
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className={adminActionToggleClass}
            aria-expanded={showAdd}
          >
            <span>
              <span className="block text-sm font-semibold text-foreground">
                Book lobby
              </span>
              <span className="text-sm text-muted-foreground">
                Map, start time, and the teams from this season that drop in.
              </span>
            </span>
            <span className="text-primary">{showAdd ? "−" : "+"}</span>
          </button>
          {showAdd ? (
            <AdminActionForm
              action={actionSchedulePubgLobby}
              successMessage="Lobby booked"
              className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2"
            >
              <input type="hidden" name="seasonId" value={seasonId} />
              <AdminField label="Lobby label">
                <input name="label" required placeholder="Game 1" className={adminControlClass} />
              </AdminField>
              <AdminField label="Map">
                <select name="map" required defaultValue="Erangel" className={adminControlClass}>
                  {PUBG_MAPS.map((map) => (
                    <option key={map} value={map}>
                      {map}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Start time" className="sm:col-span-2">
                <input name="playedAt" type="datetime-local" required className={adminControlClass} />
              </AdminField>
              <AdminField label="Teams in this lobby" className="sm:col-span-2">
                {teams.length === 0 ? (
                  <p className="m-0 text-sm text-muted-foreground">
                    No teams in this season yet. Add squads under Teams first.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {teams.map((team) => (
                      <label key={team.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="teamIds" value={team.id} />
                        {team.name}
                      </label>
                    ))}
                  </div>
                )}
              </AdminField>
              <AdminSubmitButton className="sm:col-span-2" disabled={teams.length < 2}>
                Book lobby
              </AdminSubmitButton>
            </AdminActionForm>
          ) : null}
        </div>
      ) : null}

      {game === "PUBG" ? (
        <AdminDataTable
          title={readOnly ? "Archive lobbies" : "Scheduled lobbies"}
          hint="Each row is one custom room. Record places and kills under PUBG results."
          items={lobbies}
          getId={(row) => row.id}
          hrefFor={() => `/admin/pubg?season=${publicSeasonParam ?? ""}`}
          searchPlaceholder="Search teams or map…"
          searchText={(row) => `${row.label} ${row.map} ${row.teamNames.join(" ")}`}
          emptyLabel="No lobbies booked for this season."
          columns={[
            {
              key: "lobby",
              header: "Lobby",
              cell: (row) => (
                <span className="font-medium">
                  {row.label}{" "}
                  <span className="text-muted-foreground">· {row.map}</span>
                </span>
              ),
            },
            {
              key: "when",
              header: "Start",
              cell: (row) => <span className="text-muted-foreground">{row.when}</span>,
            },
            {
              key: "teams",
              header: "Teams",
              cell: (row) => row.teamNames.join(", ") || "—",
            },
          ]}
        />
      ) : (
      <AdminDataTable
        title={readOnly ? "Archive fixtures" : "Fixtures"}
        hint={
          readOnly
            ? "Read-only. Click a fixture to see Team A vs Team B for this season."
            : "Click a fixture to set win / walkover, edit, or delete."
        }
        items={fixtures}
        getId={(f) => f.id}
        hrefFor={(f) => `/admin/schedule/${f.id}?season=${publicSeasonParam ?? ""}`}
        searchPlaceholder="Search teams…"
        searchText={(f) => `${f.teamA} ${f.teamB} ${f.kind} ${f.when}`}
        emptyLabel={
          readOnly ? "No fixtures for this season." : "No pending fixtures."
        }
        filters={[
          {
            key: "kind",
            label: "Kind",
            options: [
              ...new Set(fixtures.map((f) => f.kind)),
            ]
              .sort()
              .map((kind) => ({ value: kind, label: kind })),
            match: (f, value) => f.kind === value,
          },
          {
            key: "team",
            label: "Team",
            options: [
              ...new Set(fixtures.flatMap((f) => [f.teamA, f.teamB])),
            ]
              .sort((a, b) => a.localeCompare(b))
              .map((name) => ({ value: name, label: name })),
            match: (f, value) => f.teamA === value || f.teamB === value,
          },
        ]}
        columns={[
          {
            key: "match",
            header: "Match",
            cell: (f) => (
              <span className="font-medium">
                {f.teamA}{" "}
                <span className="text-muted-foreground">vs</span> {f.teamB}
              </span>
            ),
          },
          {
            key: "when",
            header: "When",
            cell: (f) => (
              <span className="text-muted-foreground">{f.when}</span>
            ),
          },
          {
            key: "kind",
            header: "Kind",
            cell: (f) => (
              <AdminStatus tone={f.kind === "group" ? "neutral" : "gold"}>
                {f.kind}
              </AdminStatus>
            ),
          },
          {
            key: "status",
            header: "Status",
            cell: (f) => <AdminStatus tone="ok">{f.status}</AdminStatus>,
          },
        ]}
      />
      )}
    </div>
  );
}
