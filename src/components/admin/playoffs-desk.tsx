"use client";

import {
  actionAssignPlayoffGroup,
  actionBookGroupStage,
  actionClearPlayoffFixtures,
  actionOpenPlayoffs,
  actionPostGroupStageDiscord,
  actionPostPlayoffsDiscord,
  actionSeedPlayoffGroups,
} from "@/app/admin/actions";
import {
  AdminActionForm,
  AdminSubmitButton,
} from "@/components/admin/form-controls";
import {
  AdminField,
  AdminStatus,
  adminCardClass,
  adminControlClass,
} from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export type PlayoffDeskTeam = { id: string; name: string };

export type PlayoffDeskView = {
  groupA: PlayoffDeskTeam[];
  groupB: PlayoffDeskTeam[];
  unassigned: PlayoffDeskTeam[];
  teamCount: number;
  groupSize: number;
  groupRoundRobin: number;
  groupStageComplete: boolean;
  eliminatePlace: number;
  hasLowerPlayIn: boolean;
  standingsA: { name: string; points: number; played: number }[];
  standingsB: { name: string; points: number; played: number }[];
  matchSummary: { label: string; status: string; when: string | null }[];
};

export function AdminPlayoffsDesk({
  view,
  weekendDates,
  readOnly = false,
}: {
  view: PlayoffDeskView;
  weekendDates: { name: string; value: string }[];
  readOnly?: boolean;
}) {
  const saturdays = weekendDates.filter((d) => d.name.startsWith("Saturday"));
  const sundays = weekendDates.filter((d) => d.name.startsWith("Sunday"));
  const allTeams = [
    ...view.groupA.map((t) => ({ ...t, group: "A" as const })),
    ...view.groupB.map((t) => ({ ...t, group: "B" as const })),
    ...view.unassigned.map((t) => ({ ...t, group: "" as const })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  const groupsReady =
    view.groupA.length === view.groupSize &&
    view.groupB.length === view.groupSize &&
    view.unassigned.length === 0;

  return (
    <div className="space-y-6">
      <div className={adminCardClass}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="m-0 text-base font-semibold text-foreground">
            Stage desk
          </h2>
          <AdminStatus tone="gold">
            {view.teamCount} teams · 2×{view.groupSize}
          </AdminStatus>
          {view.groupStageComplete ? (
            <AdminStatus tone="ok">Groups complete</AdminStatus>
          ) : groupsReady ? (
            <AdminStatus tone="gold">Groups set</AdminStatus>
          ) : (
            <AdminStatus tone="danger">Assign groups</AdminStatus>
          )}
        </div>
        <p className="m-0 text-sm text-muted-foreground">
          Same flow as Discord: random groups → book schedule → open upper
          bracket. Actions write the DB and sync{" "}
          <span className="text-foreground">#matches</span> when Discord env is
          set.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GroupColumn title="Group A" teams={view.groupA} />
        <GroupColumn title="Group B" teams={view.groupB} />
        <GroupColumn title="Unassigned" teams={view.unassigned} muted />
      </div>

      {!readOnly ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={adminCardClass}>
            <h3 className="mt-0 mb-1 text-sm font-semibold text-foreground">
              1. Groups
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Random shuffle into A/B, or assign one team. Same as{" "}
              <code className="text-foreground">/playoff groups</code> ·{" "}
              <code className="text-foreground">/playoff assign</code>.
            </p>
            <AdminActionForm
              action={actionSeedPlayoffGroups}
              successMessage="Groups randomized"
              confirmMessage={`Randomly split all ${view.teamCount} live teams into Group A and Group B?`}
              className="mb-4"
            >
              <AdminSubmitButton>Randomize groups</AdminSubmitButton>
            </AdminActionForm>
            <AdminActionForm
              action={actionAssignPlayoffGroup}
              successMessage="Team assigned"
              className="grid gap-3 sm:grid-cols-3"
            >
              <AdminField label="Team">
                <select name="teamName" required className={adminControlClass}>
                  <option value="">…</option>
                  {allTeams.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                      {t.group ? ` (now ${t.group})` : ""}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Group">
                <select name="group" required className={adminControlClass}>
                  <option value="A">A</option>
                  <option value="B">B</option>
                </select>
              </AdminField>
              <AdminSubmitButton className="self-end" variant="secondary">
                Assign
              </AdminSubmitButton>
            </AdminActionForm>
          </div>

          <div className={adminCardClass}>
            <h3 className="mt-0 mb-1 text-sm font-semibold text-foreground">
              2. Group schedule
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Both groups start together, one round per hour from 10:00 PM PKT.
              Every team plays every other team in its group once. An odd group
              sits one team per round, and that bye rotates. Saturday holds the
              rounds; Sunday is only used if the group is too big for one night.
              Posts to Discord #matches. Same as{" "}
              <code className="text-foreground">/schedule groups</code>.
            </p>
            <AdminActionForm
              action={actionBookGroupStage}
              successMessage="Group stage booked"
              confirmMessage="Book every group match, with Group A and Group B starting together, and post it to Discord #matches?"
              className="grid gap-3 sm:grid-cols-2"
            >
              <AdminField label="Saturday (first night)">
                <select
                  name="saturday"
                  className={adminControlClass}
                  defaultValue={saturdays[0]?.value ?? ""}
                >
                  {saturdays.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Sunday (extra night)">
                <select
                  name="sunday"
                  className={adminControlClass}
                  defaultValue={sundays[0]?.value ?? ""}
                >
                  {sundays.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </AdminField>
              <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
                <input type="checkbox" name="force" value="1" className="size-4" />
                Replace existing pending group fixtures
              </label>
              <AdminSubmitButton className="sm:col-span-2" disabled={!groupsReady}>
                Book group stage
              </AdminSubmitButton>
            </AdminActionForm>
            <AdminActionForm
              action={actionPostGroupStageDiscord}
              successMessage="Discord schedule updated"
              className="mt-3"
            >
              <AdminSubmitButton
                variant="secondary"
                disabled={view.groupRoundRobin === 0}
              >
                Re-post schedule to Discord
              </AdminSubmitButton>
            </AdminActionForm>
            {!groupsReady ? (
              <p className="mt-3 mb-0 text-xs text-rose-300/90">
                Assign every team to A or B before booking.
              </p>
            ) : null}
            {view.groupRoundRobin > 0 ? (
              <p className="mt-3 mb-0 text-xs text-muted-foreground">
                {view.groupRoundRobin} group fixtures on the schedule.
              </p>
            ) : null}
          </div>

          <div className={adminCardClass}>
            <h3 className="mt-0 mb-1 text-sm font-semibold text-foreground">
              3. Playoffs / upper bracket
            </h3>
            <p className="mb-4 text-xs text-muted-foreground">
              After every group match has a winner: open Upper R1 (A1 vs B2, B1
              vs A2)
              {view.hasLowerPlayIn
                ? `; ${view.eliminatePlace}th out; A3 vs B4 / B3 vs A4 into lower`
                : `; ${view.eliminatePlace}th out; 3rd waits for a crossover loser`}
              . Same as <code className="text-foreground">/playoff open</code>.
            </p>
            <div className="flex flex-wrap gap-2">
              <AdminActionForm
                action={actionOpenPlayoffs}
                successMessage="Playoffs opened"
                confirmMessage="Open playoffs from group standings and sync Discord #matches?"
              >
                <AdminSubmitButton disabled={!view.groupStageComplete}>
                  Open playoffs
                </AdminSubmitButton>
              </AdminActionForm>
              <AdminActionForm
                action={actionPostPlayoffsDiscord}
                successMessage="Discord updated"
              >
                <AdminSubmitButton variant="secondary">
                  Post / refresh Discord
                </AdminSubmitButton>
              </AdminActionForm>
              <AdminActionForm
                action={actionClearPlayoffFixtures}
                successMessage="Pending playoff fixtures cleared"
                confirmMessage="Clear pending playoff fixtures only? Group matches stay."
              >
                <AdminSubmitButton variant="danger">
                  Clear pending playoffs
                </AdminSubmitButton>
              </AdminActionForm>
            </div>
            {!view.groupStageComplete ? (
              <p className="mt-3 mb-0 text-xs text-muted-foreground">
                Finish all group fixtures before opening the bracket.
              </p>
            ) : null}
          </div>

          <div className={adminCardClass}>
            <h3 className="mt-0 mb-1 text-sm font-semibold text-foreground">
              4. Predictions
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Predictions use the same fixtures. Unlock/lock on the dashboard Cup
              switches (or Discord{" "}
              <code className="text-foreground">/cup predictions</code>).
            </p>
            <a
              href="/admin"
              className="text-sm font-medium text-[#7eb0ff] hover:underline"
            >
              Open Cup switches →
            </a>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Archive season — read-only. Switch to the live season to manage groups.
        </p>
      )}

      {(view.standingsA.length > 0 || view.standingsB.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <StandingsColumn title="Standings A" rows={view.standingsA} />
          <StandingsColumn title="Standings B" rows={view.standingsB} />
        </div>
      )}

      {view.matchSummary.length > 0 ? (
        <div className={adminCardClass}>
          <h3 className="mt-0 mb-3 text-sm font-semibold text-foreground">
            Bracket slots
          </h3>
          <ul className="m-0 list-none space-y-2 p-0">
            {view.matchSummary.map((m) => (
              <li
                key={m.label}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/5 pb-2 text-sm last:border-0"
              >
                <span className="font-medium text-foreground">{m.label}</span>
                <span className="text-muted-foreground">
                  {m.status}
                  {m.when ? ` · ${m.when}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function GroupColumn({
  title,
  teams,
  muted,
}: {
  title: string;
  teams: PlayoffDeskTeam[];
  muted?: boolean;
}) {
  return (
    <div className={cn(adminCardClass, muted && "opacity-90")}>
      <h3 className="mt-0 mb-2 text-sm font-semibold text-foreground">
        {title}{" "}
        <span className="font-normal text-muted-foreground">({teams.length})</span>
      </h3>
      {teams.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="m-0 list-none space-y-1 p-0">
          {teams.map((t) => (
            <li key={t.id} className="text-sm text-foreground">
              {t.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StandingsColumn({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; points: number; played: number }[];
}) {
  return (
    <div className={adminCardClass}>
      <h3 className="mt-0 mb-2 text-sm font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">No standings yet</p>
      ) : (
        <ol className="m-0 list-decimal space-y-1 pl-5 text-sm">
          {rows.map((r) => (
            <li key={r.name} className="text-foreground">
              {r.name}{" "}
              <span className="text-muted-foreground">
                · {r.points} pts · {r.played} played
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
