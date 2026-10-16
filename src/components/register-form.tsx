"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startNavigation } from "@/components/navigation-loader";
import {
  MEDALS,
  PUBG_MEDALS,
  ROLE_LABELS,
  STARTING_ROLES,
  labelForMedal,
  type StartingRole,
} from "@/lib/constants";

type Existing = {
  steamUrl: string;
  pubgName: string;
  medal: string;
  roles: StartingRole[];
  locked: boolean;
};

export function RegisterForm({
  discordName,
  existing,
  pubg = false,
  rosterLabel = "",
}: {
  discordName: string;
  existing: Existing | null;
  pubg?: boolean;
  rosterLabel?: string;
}) {
  const router = useRouter();
  const [pubgName, setPubgName] = useState(existing?.pubgName ?? "");
  const [steam, setSteam] = useState(existing?.steamUrl ?? "");
  const rankOptions = pubg ? PUBG_MEDALS : MEDALS;
  const [medal, setMedal] = useState(
    existing?.medal && (rankOptions as readonly string[]).includes(existing.medal)
      ? existing.medal
      : pubg
        ? "gold"
        : "archon",
  );
  const [roles, setRoles] = useState<StartingRole[]>(
    existing?.roles?.length ? existing.roles : ["mid"],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleRole(role: StartingRole) {
    setRoles((prev) =>
      prev.includes(role)
        ? prev.filter((r) => r !== role)
        : [...prev, role],
    );
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!pubg && roles.length === 0) {
      setError("Pick at least one role.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steam, pubgName, medal, roles }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Registration failed.");
        return;
      }
      startNavigation();
      router.push(`/players/${data.id}`);
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="register-form" onSubmit={onSubmit}>
      <label className="register-field">
        <span>Discord</span>
        <input value={discordName} disabled readOnly />
      </label>

      {pubg ? (
        <label className="register-field">
          <span>PUBG name</span>
          <input
            required
            minLength={2}
            maxLength={24}
            placeholder="In-game name"
            value={pubgName}
            onChange={(e) => setPubgName(e.target.value)}
            disabled={busy || existing?.locked}
          />
          {rosterLabel ? <small>{rosterLabel}</small> : null}
        </label>
      ) : null}

      <label className="register-field">
        <span>Steam profile</span>
        <input
          type="url"
          required
          placeholder="https://steamcommunity.com/id/…"
          value={steam}
          onChange={(e) => setSteam(e.target.value)}
          disabled={busy || existing?.locked}
        />
      </label>

      <label className="register-field">
        <span>{pubg ? "Rank" : "Medal"}</span>
        <select
          value={medal}
          onChange={(e) => setMedal(e.target.value)}
          disabled={busy || existing?.locked}
        >
          {rankOptions.map((m) => (
            <option key={m} value={m}>
              {labelForMedal(m)}
            </option>
          ))}
        </select>
      </label>

      {pubg ? null : (
        <fieldset className="register-field register-roles" disabled={busy || existing?.locked}>
          <legend>Roles</legend>
          <div className="register-role-grid">
            {STARTING_ROLES.map((r) => (
              <label key={r} className="register-role-chip">
                <input
                  type="checkbox"
                  checked={roles.includes(r)}
                  onChange={() => toggleRole(r)}
                />
                <span>{ROLE_LABELS[r]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {existing?.locked ? (
        <p className="muted">Medal and roles are locked while you are on a team.</p>
      ) : null}

      {error ? (
        <p className="register-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn btn-gold" disabled={busy}>
        {busy ? "Saving…" : existing ? "Update" : "Register"}
      </button>
    </form>
  );
}
