/**
 * Honest match “read” from scoreboard fields we already store.
 * No gold-swing throw/comeback labels — OCR does not persist advantage graphs.
 */

export const MATCH_KIND = {
  stomp: "stomp",
  knife: "knife",
  grind: "grind",
  bloodbath: "bloodbath",
  standard: "standard",
} as const;

export type MatchKind = (typeof MATCH_KIND)[keyof typeof MATCH_KIND];

export type MatchNarrative = {
  kind: MatchKind;
  label: string;
  blurb: string;
};

const STOMP_KILL_GAP = 18;
const KNIFE_KILL_GAP = 5;
const GRIND_SECONDS = 45 * 60;
const BLOODBATH_KILLS = 75;

export function classifyMatchNarrative(input: {
  duration?: number | null;
  radiantKills: number;
  direKills: number;
  hasScore: boolean;
}): MatchNarrative | null {
  if (!input.hasScore) return null;

  const killDiff = Math.abs(input.radiantKills - input.direKills);
  const totalKills = input.radiantKills + input.direKills;
  const duration = input.duration ?? 0;

  if (killDiff >= STOMP_KILL_GAP) {
    return {
      kind: MATCH_KIND.stomp,
      label: "Stomp",
      blurb: `Never close · ${killDiff} kill gap`,
    };
  }

  if (duration >= GRIND_SECONDS) {
    const mins = Math.round(duration / 60);
    return {
      kind: MATCH_KIND.grind,
      label: "Grind",
      blurb: `${mins} minutes of it`,
    };
  }

  if (totalKills >= BLOODBATH_KILLS) {
    return {
      kind: MATCH_KIND.bloodbath,
      label: "Bloodbath",
      blurb: `${totalKills} kills logged`,
    };
  }

  if (killDiff <= KNIFE_KILL_GAP) {
    return {
      kind: MATCH_KIND.knife,
      label: "Knife-edge",
      blurb:
        killDiff === 0
          ? "Same kill count on the board"
          : `Decided by ${killDiff} kill${killDiff === 1 ? "" : "s"}`,
    };
  }

  return {
    kind: MATCH_KIND.standard,
    label: "Match",
    blurb: `${killDiff} kill gap`,
  };
}

export const MATCH_KIND_FILTERS: { key: MatchKind | "any"; label: string }[] = [
  { key: "any", label: "Any" },
  { key: MATCH_KIND.stomp, label: "Stomps" },
  { key: MATCH_KIND.knife, label: "Knife-edge" },
  { key: MATCH_KIND.grind, label: "Grinds" },
  { key: MATCH_KIND.bloodbath, label: "Bloodbaths" },
];
