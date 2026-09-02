"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FLEX, MEDAL_LABELS, MEDALS, ROLE_LABELS, ROLES } from "@/lib/constants";
import {
  PLAY_WINDOW_LABELS,
  PLAY_WINDOWS,
  type PlayWindow,
} from "@/lib/play-window";
import { STEAM_PROFILE_HELP } from "@/lib/steam";

const ROLE_OPTIONS = [...ROLES, FLEX] as const;

type Existing = {
  steamUrl: string;
  medal: string;
  role: string;
  playWindow: PlayWindow;
  locked: boolean;
};

export function RegisterForm({
  discordName,
  existing,
}: {
  discordName: string;
  existing: Existing | null;
}) {
  const router = useRouter();
  const [steam, setSteam] = useState(existing?.steamUrl ?? "");
  const [medal, setMedal] = useState(existing?.medal ?? "archon");
  const [role, setRole] = useState(existing?.role ?? "mid");
  const [playWindow, setPlayWindow] = useState<PlayWindow>(
    existing?.playWindow ?? "both",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steam, medal, role, playWindow }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Registration failed.");
        return;
      }
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

      <label className="register-field">
        <span>Steam profile URL</span>
        <input
          type="url"
          required
          placeholder="https://steamcommunity.com/id/yourname"
          value={steam}
          onChange={(e) => setSteam(e.target.value)}
          disabled={busy || existing?.locked}
        />
        <small>{STEAM_PROFILE_HELP}</small>
      </label>

      <div className="register-row">
        <label className="register-field">
          <span>Rank</span>
          <select
            value={medal}
            onChange={(e) => setMedal(e.target.value)}
            disabled={busy || existing?.locked}
          >
            {MEDALS.map((m) => (
              <option key={m} value={m}>
                {MEDAL_LABELS[m]}
              </option>
            ))}
          </select>
        </label>

        <label className="register-field">
          <span>Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={busy || existing?.locked}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="register-field">
        <span>Weekend availability (Pakistan time)</span>
        <select
          value={playWindow}
          onChange={(e) => setPlayWindow(e.target.value as PlayWindow)}
          disabled={busy}
        >
          {PLAY_WINDOWS.map((w) => (
            <option key={w} value={w}>
              {PLAY_WINDOW_LABELS[w]}
            </option>
          ))}
        </select>
        <small>
          Evening games kick off at 11:30 PM. Late games kick off at 12:30 AM.
          Pick <strong>Available either window</strong> if you can play both.
        </small>
      </label>

      {existing?.locked ? (
        <p className="muted">
          Medal and role are locked because you already joined a team. You can
          still change your weekend play window.
        </p>
      ) : null}

      {error ? (
        <p className="register-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn btn-gold" disabled={busy}>
        {busy
          ? "Saving…"
          : existing
            ? "Update registration"
            : "Register for the cup"}
      </button>
    </form>
  );
}
