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
import { actionCreateFixture } from "@/app/admin/actions";
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

export function AdminScheduleBoard({
  fixtures,
  teams,
}: {
  fixtures: AdminFixtureRow[];
  teams: { id: string; name: string }[];
}) {
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-6">
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
            className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 lg:grid-cols-5"
          >
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
                <option value="group">Group</option>
                <option value="playoff">Playoff</option>
                <option value="final">Final</option>
              </select>
            </AdminField>
            <AdminSubmitButton className="sm:col-span-2 lg:col-span-5">
              Book match
            </AdminSubmitButton>
          </AdminActionForm>
        ) : null}
      </div>

      <AdminDataTable
        title="Fixtures"
        hint="Click a fixture to edit or delete it."
        items={fixtures}
        getId={(f) => f.id}
        hrefFor={(f) => `/admin/schedule/${f.id}`}
        searchPlaceholder="Search teams…"
        searchText={(f) => `${f.teamA} ${f.teamB} ${f.kind} ${f.when}`}
        emptyLabel="No pending fixtures."
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
    </div>
  );
}
