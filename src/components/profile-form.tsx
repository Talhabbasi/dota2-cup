"use client";

import { useState } from "react";
import { AvatarMaker } from "@/components/avatar/avatar-maker";
import { saveProfile } from "@/app/profile/actions";
import { ROLE_LABELS, STARTING_ROLES, type StartingRole } from "@/lib/constants";
import { parseAvatarConfig } from "@/lib/avatar/defaults";
import { generatedAvatar } from "@/lib/avatar/roster";
import type { AvatarConfig } from "@/lib/avatar/types";

export function ProfileForm({
  profileName,
  about,
  roles,
  avatarConfig,
  avatarSeed,
  discordId,
  steamLabel,
}: {
  profileName: string;
  about: string;
  roles: StartingRole[];
  avatarConfig: string;
  avatarSeed: string;
  discordId: string;
  steamLabel: string;
}) {
  const [name, setName] = useState(profileName);
  const [bio, setBio] = useState(about);
  const [pickedRoles, setPickedRoles] = useState<StartingRole[]>(roles);
  const [avatar, setAvatar] = useState<AvatarConfig>(
    () => parseAvatarConfig(avatarConfig) ?? generatedAvatar(avatarSeed),
  );
  const [useDefault, setUseDefault] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  function toggleRole(role: StartingRole) {
    setPickedRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const body = new FormData(event.currentTarget);
    body.set("avatarConfig", useDefault ? "" : JSON.stringify(avatar));
    if (useDefault) body.set("useDefault", "1");
    const result = await saveProfile(body);
    setPending(false);
    setMessage(result && "ok" in result ? "Profile saved." : (result?.error ?? "Could not save."));
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm">
          Name
          <input
            name="profileName"
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            className="rounded-md border border-white/15 bg-transparent px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          About
          <textarea
            name="about"
            value={bio}
            maxLength={400}
            rows={4}
            onChange={(event) => setBio(event.target.value)}
            className="rounded-md border border-white/15 bg-transparent px-3 py-2"
          />
        </label>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">Roles</legend>
        <div className="team-view-toggle team-season-tabs">
          {STARTING_ROLES.map((role) => (
            <label key={role}>
              <input
                type="checkbox"
                name="roles"
                value={role}
                checked={pickedRoles.includes(role)}
                onChange={() => toggleRole(role)}
                className="sr-only"
              />
              <span className={pickedRoles.includes(role) ? "active" : undefined}>
                {ROLE_LABELS[role]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="grid gap-3">
        <h2 className="m-0 text-base font-semibold">Roster character</h2>
        <p className="m-0 text-sm text-muted-foreground">
          Customize your character, body build, and outfit. Your profile keeps your colors; team rosters match your shirt, hoodie, or jersey to the team color.
        </p>
        {!useDefault ? <AvatarMaker initial={avatar} onChange={setAvatar} /> : null}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="useDefault"
            value="1"
            checked={useDefault}
            onChange={(event) => setUseDefault(event.target.checked)}
          />
          Use my generated default character
        </label>
      </section>

      <div className="grid gap-1 text-sm text-muted-foreground">
        <p className="m-0">Discord ID {discordId}</p>
        <p className="m-0">Steam ID {steamLabel}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="team-view-toggle">
          <button type="submit" className="active" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </button>
        </div>
        {message ? <p className="m-0 text-sm">{message}</p> : null}
      </div>
    </form>
  );
}
