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

export type PickStatus = "none" | "picked" | "correct" | "busted";

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
  pickTeamName: string | null;
  pickStatus: PickStatus;
  winnerTeamId: string | null;
  locked: boolean;
  completed: boolean;
  /** True when both sides are known so a winner can be tapped. */
  ready: boolean;
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

/**
 * Apply user picks onto open slots. Re-walks until no new results appear so
 * cascading winners/losers unlock the next round in the same pass.
 */
export function applyPicksToResults(
  seeds: GroupSeeds,
  actual: Partial<Record<BracketSlot, SlotResult>>,
  picks: Partial<Record<BracketSlot, string>>,
): Partial<Record<BracketSlot, SlotResult>> {
  const results: Partial<Record<BracketSlot, SlotResult>> = { ...actual };
  let changed = true;
  while (changed) {
    changed = false;
    for (const slot of BRACKET_SLOTS) {
      if (results[slot]) continue;
      const pairing = unlockedPairings(seeds, results)[slot];
      if (!pairing.left || !pairing.right) continue;
      const pickId = picks[slot];
      if (pickId === pairing.left.id) {
        results[slot] = { winner: pairing.left, loser: pairing.right };
        changed = true;
      } else if (pickId === pairing.right.id) {
        results[slot] = { winner: pairing.right, loser: pairing.left };
        changed = true;
      }
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

function teamNameInPairing(
  pairing: { left: NamedTeam | null; right: NamedTeam | null },
  teamId: string | null,
): string | null {
  if (!teamId) return null;
  if (pairing.left?.id === teamId) return pairing.left.name;
  if (pairing.right?.id === teamId) return pairing.right.name;
  return null;
}

function findTeamName(
  seeds: GroupSeeds,
  results: Partial<Record<BracketSlot, SlotResult>>,
  pairing: { left: NamedTeam | null; right: NamedTeam | null },
  teamId: string | null,
): string | null {
  if (!teamId) return null;
  const inPair = teamNameInPairing(pairing, teamId);
  if (inPair) return inPair;
  for (const team of Object.values(seeds)) {
    if (team.id === teamId) return team.name;
  }
  for (const result of Object.values(results)) {
    if (!result) continue;
    if (result.winner.id === teamId) return result.winner.name;
    if (result.loser.id === teamId) return result.loser.name;
  }
  return null;
}

function resolvePickStatus(input: {
  pickId: string | null;
  completed: boolean;
  winnerTeamId: string | null;
  /** False when the pick no longer sits in this matchup. */
  stillInMatch: boolean;
}): PickStatus {
  const { pickId, completed, winnerTeamId, stillInMatch } = input;
  if (!pickId) return "none";
  if (completed) {
    if (winnerTeamId && pickId === winnerTeamId) return "correct";
    return "busted";
  }
  if (!stillInMatch) return "busted";
  return "picked";
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
    const ready = Boolean(pairing.left && pairing.right);
    const myPickId = picks[slot] ?? null;
    const inMatch = Boolean(
      myPickId &&
        (pairing.left?.id === myPickId || pairing.right?.id === myPickId),
    );
    // Until both sides are known, a stored pick is still "pending", not busted.
    const stillInMatch = !myPickId || inMatch || !ready;
    const pickTeamName = findTeamName(seeds, results, pairing, myPickId);
    const pickStatus = resolvePickStatus({
      pickId: myPickId,
      completed,
      winnerTeamId: actualResult?.winner.id ?? null,
      stillInMatch,
    });

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
      myPickId,
      pickTeamName,
      pickStatus,
      winnerTeamId: actualResult?.winner.id ?? null,
      locked,
      completed,
      ready,
      waiting: meta.waiting,
      winnerGoes: meta.winnerGoes,
      loserGoes: meta.loserGoes,
    };
  });
}
