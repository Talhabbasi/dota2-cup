"use client";

import { AvatarMaker } from "@/components/avatar/avatar-maker";
import { PlayerAvatar } from "@/components/avatar/player-avatar";
import { SKIN_TONES } from "@/lib/avatar/colors";
import { defaultAvatarConfig, parseAvatarConfig } from "@/lib/avatar/defaults";
import { LOCAL_AVATAR_KEY, type AvatarConfig } from "@/lib/avatar/types";
import { useEffect, useState } from "react";

function skinFromToneParam() {
  const raw = new URLSearchParams(window.location.search).get("tone");
  if (raw == null || raw === "" || !/^\d+$/.test(raw)) return null;
  return SKIN_TONES[Number(raw)] ?? null;
}

export default function DevAvatarPage() {
  const [config, setConfig] = useState<AvatarConfig>(() => defaultAvatarConfig("male"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const skinTone = skinFromToneParam();
    const stored = parseAvatarConfig(localStorage.getItem(LOCAL_AVATAR_KEY));
    if (skinTone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- apply ?tone= after mount
      setConfig({ ...defaultAvatarConfig("male"), skinTone });
    } else if (stored) {
      setConfig(stored);
    }
    setReady(true);
  }, []);

  return (
    <div className="page grid gap-6">
      <div>
        <h1 className="mt-0">Avatar maker preview</h1>
        <p className="text-sm text-muted-foreground">
          Dev-only layered avatar check. Phase 3 assets: 3 hairstyles per gender, beards, clothing.
        </p>
      </div>
      {ready ? (
        <>
          <PlayerAvatar config={config} size={96} circular />
          <AvatarMaker initial={config} onChange={setConfig} />
        </>
      ) : null}
    </div>
  );
}
