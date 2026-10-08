"use client";

import { useState, useTransition } from "react";
import {
  actionCreateCaptainAccount,
  actionRevokeCaptainAccount,
} from "@/app/admin/actions";
import {
  AdminActionForm,
  AdminSubmitButton,
} from "@/components/admin/form-controls";
import { AdminField, adminControlClass } from "@/components/admin/ui";

type TeamOpt = { id: string; name: string; tag: string | null };
type AccountRow = {
  id: string;
  loginName: string;
  teamName: string;
  teamId: string;
};

export function CaptainCredentialsPanel({
  teams,
  accounts,
  readOnly = false,
}: {
  teams: TeamOpt[];
  accounts: AccountRow[];
  readOnly?: boolean;
}) {
  const [created, setCreated] = useState<{
    loginName: string;
    passcode: string;
    token: string;
    teamName: string;
  } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-4">
      {readOnly ? (
        <p className="m-0 text-sm text-muted-foreground">
          Captain logins for this season are listed below. New logins are created on the active cup.
        </p>
      ) : (
      <>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          start(async () => {
            const result = await actionCreateCaptainAccount(data);
            setCreated({
              loginName: result.loginName,
              passcode: result.passcode,
              token: result.token,
              teamName: result.teamName,
            });
          });
        }}
      >
        <AdminField label="Team">
          <select name="teamId" required className={adminControlClass}>
            <option value="">…</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.tag ? ` (${t.tag})` : ""}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="Login name (optional)">
          <input
            name="loginName"
            placeholder="auto from tag"
            className={adminControlClass}
          />
        </AdminField>
        <AdminField label="Passcode (optional)">
          <input
            name="passcode"
            placeholder="auto-generate"
            className={adminControlClass}
          />
        </AdminField>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {pending ? "Creating…" : "Generate captain login"}
          </button>
        </div>
      </form>

      {created ? (
        <div
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm"
          role="status"
        >
          <p className="m-0 font-semibold">{created.teamName} credentials</p>
          <p className="m-0 mt-1">
            Login: <code>{created.loginName}</code>
          </p>
          <p className="m-0">
            Passcode: <code>{created.passcode}</code>
          </p>
          <p className="m-0 text-xs text-muted-foreground">
            Copy now — passcode is not shown again. Captain signs in at{" "}
            <code>/auction/captain</code>.
          </p>
        </div>
      ) : null}
      </>
      )}

      <ul className="m-0 grid list-none gap-2 p-0">
        {accounts.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 px-3 py-2 text-sm"
          >
            <span>
              <code>{row.loginName}</code> → {row.teamName}
            </span>
            {readOnly ? null : (
            <AdminActionForm
              action={actionRevokeCaptainAccount}
              successMessage="Revoked"
              confirmMessage={`Revoke ${row.loginName}?`}
            >
              <input type="hidden" name="accountId" value={row.id} />
              <AdminSubmitButton variant="secondary" className="text-xs">
                Revoke
              </AdminSubmitButton>
            </AdminActionForm>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
