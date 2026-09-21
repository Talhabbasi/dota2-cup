import {
  BRACKET_META,
  BRACKET_SLOTS,
  isBracketSlot,
  unlockedPairings,
  type BracketSlot,
  type GroupSeeds,
  type NamedTeam,
  type SlotResult,
} from "./playoff-tree";

export type BracketPickInput = {
  slotKey: string;
  teamId: string;
};

export type PickemSlotView = {
  slotKey: BracketSlot;
  label: string;
  round: string;
  stage: "upper" | "lower" | "grand";
  points: number;
  bestOf: number;
  matchNumber: number | null;
  left: NamedTeam | null;
  right: NamedTeam | null;
  leftLabel: string;
  rightLabel: string;
  myPickId: string | null;
  winnerTeamId: string | null;
  locked: boolean;
  completed: boolean;
  waiting: string;
  winnerGoes: string;
  loserGoes: string;
};

export function pickMapFrom(
  picks: { slotKey: string; teamId: string }[],
): Partial<Record<BracketSlot, string>> {
  const out: Partial<Record<BracketSlot, string>> = {};
  for (const pick of picks) {
    if (!isBracketSlot(pick.slotKey) || !pick.teamId) continue;
    out[pick.slotKey] = pick.teamId;
  }
  return out;
}

export function applyPicksToResults(
  seeds: GroupSeeds,
  actual: Partial<Record<BracketSlot, SlotResult>>,
  picks: Partial<Record<BracketSlot, string>>,
): Partial<Record<BracketSlot, SlotResult>> {
  const results: Partial<Record<BracketSlot, SlotResult>> = { ...actual };
  for (const slot of BRACKET_SLOTS) {
    if (results[slot]) continue;
    const pairing = unlockedPairings(seeds, results)[slot];
    if (!pairing.left || !pairing.right) continue;
    const pickId = picks[slot];
    if (pickId === pairing.left.id) {
      results[slot] = { winner: pairing.left, loser: pairing.right };
    } else if (pickId === pairing.right.id) {
      results[slot] = { winner: pairing.right, loser: pairing.left };
    }
  }
  return results;
}

export function resolvedBracketPicks(
  seeds: GroupSeeds,
  actual: Partial<Record<BracketSlot, SlotResult>>,
  picks: Partial<Record<BracketSlot, string>>,
): { slotKey: BracketSlot; teamId: string }[] {
  const results = applyPicksToResults(seeds, actual, picks);
  const pairings = unlockedPairings(seeds, results);
  const saved: { slotKey: BracketSlot; teamId: string }[] = [];
  for (const slot of BRACKET_SLOTS) {
    if (actual[slot]) continue;
    const pairing = pairings[slot];
    const pickId = picks[slot];
    if (!pairing.left || !pairing.right || !pickId) continue;
    if (pickId !== pairing.left.id && pickId !== pairing.right.id) continue;
    saved.push({ slotKey: slot, teamId: pickId });
  }
  return saved;
}

export function pickemSlots(
  seeds: GroupSeeds,
  actual: Partial<Record<BracketSlot, SlotResult>>,
  picks: Partial<Record<BracketSlot, string>>,
  lockedSlots: Set<BracketSlot>,
  treeLocked: boolean,
): PickemSlotView[] {
  const results = applyPicksToResults(seeds, actual, picks);
  const pairings = unlockedPairings(seeds, results);
  return BRACKET_SLOTS.map((slot) => {
    const meta = BRACKET_META[slot];
    const pairing = pairings[slot];
    const actualResult = actual[slot];
    const completed = Boolean(actualResult);
    const locked = treeLocked || completed || lockedSlots.has(slot);
    return {
      slotKey: slot,
      label: meta.label,
      round: meta.round,
      stage: meta.stage,
      points: slot === "final" ? 50 : 10,
      bestOf: meta.bestOf,
      matchNumber: meta.matchNumber,
      left: pairing.left,
      right: pairing.right,
      leftLabel: pairing.leftLabel,
      rightLabel: pairing.rightLabel,
      myPickId: actualResult?.winner.id ?? picks[slot] ?? null,
      winnerTeamId: actualResult?.winner.id ?? null,
      locked,
      completed,
      waiting: meta.waiting,
      winnerGoes: meta.winnerGoes,
      loserGoes: meta.loserGoes,
    };
  });
}
