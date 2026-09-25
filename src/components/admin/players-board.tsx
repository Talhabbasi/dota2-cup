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
import { actionRegisterPlayer } from "@/app/admin/actions";
import {
  AdminActionForm,
  AdminSubmitButton,
} from "@/components/admin/form-controls";
import { cn } from "@/lib/utils";

export type AdminPlayerRow = {
  id: string;
  discordId: string;
  steamName: string;
  medal: string;
  medalLabel: string;
  teamName: string | null;
  isCaptain: boolean;
  rosterRole: string | null;
};

export function AdminPlayersBoard({
  players,
  medalOptions,
  roleOptions,
  windowOptions,
}: {
  players: AdminPlayerRow[];
  teams: { id: string; name: string }[];
  medalOptions: { value: string; label: string }[];
  roleOptions: { value: string; label: string }[];
  windowOptions: { value: string; label: string }[];
}) {
  const [showRegister, setShowRegister] = useState(false);

  return (
    <div className="space-y-6">
      <div
        className={cn(
          adminCardClass,
          !showRegister &&
            "transition hover:border-[#487fff]/35 hover:bg-[#161e2e]",
        )}
      >
        <button
          type="button"
          onClick={() => setShowRegister((v) => !v)}
          className={adminActionToggleClass}
          aria-expanded={showRegister}
        >
          <span>
            <span className="block text-sm font-semibold text-foreground">
              Register player
            </span>
            <span className="text-sm text-muted-foreground">
              Add someone by Steam URL (Discord id optional).
            </span>
          </span>
          <span className="text-primary">{showRegister ? "−" : "+"}</span>
        </button>
        {showRegister ? (
          <AdminActionForm
            action={actionRegisterPlayer}
            successMessage="Player registered"
            className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2"
          >
            <AdminField label="Steam profile URL">
              <input
                name="steam"
                required
                className={adminControlClass}
                placeholder="https://steamcommunity.com/id/…"
              />
            </AdminField>
            <AdminField label="Discord user id">
              <input
                name="discordId"
                className={adminControlClass}
                placeholder="Optional"
              />
            </AdminField>
            <AdminField label="Display name">
              <input name="discordName" className={adminControlClass} />
            </AdminField>
            <AdminField label="Medal">
              <select
                name="medal"
                required
                defaultValue="legend"
                className={adminControlClass}
              >
                {medalOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Role">
              <select
                name="role"
                required
                defaultValue="mid"
                className={adminControlClass}
              >
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Weekend window">
              <select
                name="playWindow"
                required
                defaultValue="both"
                className={adminControlClass}
              >
                {windowOptions.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminSubmitButton className="sm:col-span-2">
              Register
            </AdminSubmitButton>
          </AdminActionForm>
        ) : null}
      </div>

      <AdminDataTable
        title="Players"
        hint="Click a player to open their full admin page."
        items={players}
        getId={(p) => p.id}
        hrefFor={(p) => `/admin/players/${p.id}`}
        searchPlaceholder="Search name or Discord id…"
        searchText={(p) =>
          `${p.steamName} ${p.discordId} ${p.teamName ?? ""} ${p.medalLabel}`
        }
        emptyLabel="No registered players."
        filters={[
          {
            key: "slot",
            label: "Slot",
            options: [
              { value: "captain", label: "Captain" },
              { value: "starter", label: "Starter" },
              { value: "sub", label: "Substitute" },
              { value: "unsigned", label: "Unsigned" },
            ],
            match: (p, value) => {
              if (value === "captain") return p.isCaptain;
              if (value === "sub") return p.rosterRole === "sub";
              if (value === "unsigned") return !p.teamName;
              if (value === "starter")
                return Boolean(p.teamName) && !p.isCaptain && p.rosterRole !== "sub";
              return true;
            },
          },
          {
            key: "medal",
            label: "Rank",
            options: [
              ...new Map(
                players.map((p) => [p.medal, p.medalLabel] as const),
              ).entries(),
            ]
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([value, label]) => ({ value, label })),
            match: (p, value) => p.medal === value,
          },
          {
            key: "team",
            label: "Team",
            options: [
              { value: "__unsigned__", label: "Unsigned" },
              ...[
                ...new Set(
                  players.map((p) => p.teamName).filter(Boolean) as string[],
                ),
              ]
                .sort((a, b) => a.localeCompare(b))
                .map((name) => ({ value: name, label: name })),
            ],
            match: (p, value) =>
              value === "__unsigned__" ? !p.teamName : p.teamName === value,
          },
        ]}
        columns={[
          {
            key: "name",
            header: "Name",
            cell: (p) => <span className="font-medium">{p.steamName}</span>,
          },
          {
            key: "medal",
            header: "Rank",
            cell: (p) => p.medalLabel,
          },
          {
            key: "team",
            header: "Team",
            cell: (p) => p.teamName ?? "Unsigned",
          },
          {
            key: "slot",
            header: "Slot",
            cell: (p) => (
              <AdminStatus
                tone={
                  p.isCaptain
                    ? "gold"
                    : p.rosterRole === "sub"
                      ? "neutral"
                      : p.teamName
                        ? "ok"
                        : "warn"
                }
              >
                {p.isCaptain
                  ? "captain"
                  : p.rosterRole === "sub"
                    ? "sub"
                    : p.teamName
                      ? "starter"
                      : "unsigned"}
              </AdminStatus>
            ),
          },
        ]}
      />
    </div>
  );
}
