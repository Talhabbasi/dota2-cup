"use client";

import { AvatarCanvas } from "@/components/avatar/avatar-canvas";
import { defaultAvatarConfig, parseAvatarConfig } from "@/lib/avatar/defaults";
import type { AvatarConfig } from "@/lib/avatar/types";

export function PlayerAvatar({
  config,
  size = 128,
  className,
  circular = false,
}: {
  config?: AvatarConfig | string | null;
  size?: number;
  className?: string;
  circular?: boolean;
}) {
  const resolved =
    typeof config === "string"
      ? parseAvatarConfig(config) ?? defaultAvatarConfig()
      : config ?? defaultAvatarConfig();

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        borderRadius: circular ? "999px" : 14,
        overflow: "hidden",
        background: "#12161d",
      }}
    >
      <AvatarCanvas config={resolved} size={size} />
    </span>
  );
}
