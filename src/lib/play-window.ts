export const PLAY_WINDOWS = ["evening", "late", "both"] as const;
export type PlayWindow = (typeof PLAY_WINDOWS)[number];
export type KickoffWindow = "evening" | "late";

export const PLAY_WINDOW_LABELS: Record<PlayWindow, string> = {
  evening: "8:00 PM – 12:00 AM PKT",
  late: "After 12:00 AM PKT",
  both: "Either window",
};

export const PLAY_WINDOW_SHORT: Record<PlayWindow, string> = {
  evening: "8pm–12am",
  late: "After 12am",
  both: "Both",
};

export const PLAY_WINDOW_DISCORD_CHOICES = [
  { name: "8pm–12am PKT", value: "evening" },
  { name: "After 12am PKT", value: "late" },
  { name: "Either window", value: "both" },
] as const;

export const PLAY_WINDOW_ROLE_NAMES: Record<KickoffWindow, string> = {
  evening: "Evening 8-12",
  late: "Late after 12",
};

export function parsePlayWindow(input: string | null | undefined): PlayWindow {
  const v = (input ?? "").trim().toLowerCase();
  if (v === "evening" || v === "early" || v === "8-12" || v === "before12") {
    return "evening";
  }
  if (v === "late" || v === "after12" || v === "after_12" || v === "after-12") {
    return "late";
  }
  if (v === "both" || v === "any" || v === "flex" || v === "either") return "both";
  throw new Error(
    "Pick a weekend window: **evening** (8pm–12am), **late** (after 12am), or **both**.",
  );
}

export function playWindowOrBoth(input: string | null | undefined): PlayWindow {
  try {
    return parsePlayWindow(input ?? "both");
  } catch {
    return "both";
  }
}

export function canPlayIn(window: PlayWindow, slot: KickoffWindow): boolean {
  return window === "both" || window === slot;
}

export function windowsOverlap(a: PlayWindow, b: PlayWindow): boolean {
  return (
    (canPlayIn(a, "evening") && canPlayIn(b, "evening")) ||
    (canPlayIn(a, "late") && canPlayIn(b, "late"))
  );
}

/** Common slot the whole roster can actually play. Mixed evening-only + late-only → both (admin should fix). */
export function deriveTeamPlayWindow(windows: PlayWindow[]): PlayWindow {
  if (windows.length === 0) return "both";
  const eveningOk = windows.every((w) => canPlayIn(w, "evening"));
  const lateOk = windows.every((w) => canPlayIn(w, "late"));
  if (eveningOk && lateOk) return "both";
  if (eveningOk) return "evening";
  if (lateOk) return "late";
  return "both";
}

export function matchKickoffWindow(
  radiant: PlayWindow,
  dire: PlayWindow,
): KickoffWindow {
  const eveningOk = canPlayIn(radiant, "evening") && canPlayIn(dire, "evening");
  const lateOk = canPlayIn(radiant, "late") && canPlayIn(dire, "late");
  if (eveningOk && !lateOk) return "evening";
  if (lateOk && !eveningOk) return "late";
  if (eveningOk) return "evening";
  if (lateOk) return "late";
  return "evening";
}
