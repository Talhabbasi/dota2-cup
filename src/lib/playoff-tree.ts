export const BRACKET_SLOTS = [
  "ub1",
  "ub2",
  "lb1",
  "lb2",
  "lb3",
  "uf",
  "lb_final",
  "final",
] as const;

export type BracketSlot = (typeof BRACKET_SLOTS)[number];

export const PLAYOFF_BOOK_KINDS = [
  "adv",
  "ub",
  "ub_final",
  "lb",
  "lb_final",
  "final",
] as const;

export type NamedTeam = { id: string; name: string };

export type GroupSeeds = {
  a1: NamedTeam;
  a2: NamedTeam;
  a3: NamedTeam;
  a4: NamedTeam;
  b1: NamedTeam;
  b2: NamedTeam;
  b3: NamedTeam;
  b4: NamedTeam;
};

export type SlotResult = {
  winner: NamedTeam;
  loser: NamedTeam;
};

export type SlotPairing = {
  left: NamedTeam | null;
  right: NamedTeam | null;
  leftLabel: string;
  rightLabel: string;
};

export type BracketMeta = {
  slotKey: BracketSlot;
  kind: (typeof PLAYOFF_BOOK_KINDS)[number];
  matchNumber: number | null;
  bestOf: number;
  label: string;
  stage: "upper" | "lower" | "grand";
  round: string;
  leftLabel: string;
  rightLabel: string;
  waiting: string;
  winnerGoes: string;
  loserGoes: string;
};

export const BRACKET_META: Record<BracketSlot, BracketMeta> = {
  ub1: {
    slotKey: "ub1",
    kind: "ub",
    matchNumber: 1,
    bestOf: 1,
    label: "Match 1 · Upper Round 1",
    stage: "upper",
    round: "Upper Round 1",
    leftLabel: "Group A 1st",
    rightLabel: "Group B 2nd",
    waiting: "Waiting for Group A and Group B to finish",
    winnerGoes: "Upper Final",
    loserGoes: "Lower Round 1 vs Group A 3rd",
  },
  ub2: {
    slotKey: "ub2",
    kind: "ub",
    matchNumber: 2,
    bestOf: 1,
    label: "Match 2 · Upper Round 1",
    stage: "upper",
    round: "Upper Round 1",
    leftLabel: "Group B 1st",
    rightLabel: "Group A 2nd",
    waiting: "Waiting for Group A and Group B to finish",
    winnerGoes: "Upper Final",
    loserGoes: "Lower Round 1 vs Group B 3rd",
  },
  lb1: {
    slotKey: "lb1",
    kind: "lb",
    matchNumber: 3,
    bestOf: 1,
    label: "Match 3 · Lower Round 1",
    stage: "lower",
    round: "Lower Round 1",
    leftLabel: "Group A 3rd",
    rightLabel: "Match 1 loser",
    waiting: "Waiting for Upper Round 1 Match 1 (A1 vs B2)",
    winnerGoes: "Lower Round 2",
    loserGoes: "Eliminated",
  },
  lb2: {
    slotKey: "lb2",
    kind: "lb",
    matchNumber: 4,
    bestOf: 1,
    label: "Match 4 · Lower Round 1",
    stage: "lower",
    round: "Lower Round 1",
    leftLabel: "Group B 3rd",
    rightLabel: "Match 2 loser",
    waiting: "Waiting for Upper Round 1 Match 2 (B1 vs A2)",
    winnerGoes: "Lower Round 2",
    loserGoes: "Eliminated",
  },
  lb3: {
    slotKey: "lb3",
    kind: "lb",
    matchNumber: 6,
    bestOf: 1,
    label: "Match 6 · Lower Round 2",
    stage: "lower",
    round: "Lower Round 2",
    leftLabel: "Match 3 winner",
    rightLabel: "Match 4 winner",
    waiting: "Waiting for both Lower Round 1 matches",
    winnerGoes: "Lower Final",
    loserGoes: "Eliminated",
  },
  uf: {
    slotKey: "uf",
    kind: "ub_final",
    matchNumber: 5,
    bestOf: 1,
    label: "Match 5 · Upper Final",
    stage: "upper",
    round: "Upper Final",
    leftLabel: "Match 1 winner",
    rightLabel: "Match 2 winner",
    waiting: "Waiting for both Upper Round 1 matches",
    winnerGoes: "Grand Final",
    loserGoes: "Lower Final",
  },
  lb_final: {
    slotKey: "lb_final",
    kind: "lb_final",
    matchNumber: 7,
    bestOf: 1,
    label: "Match 7 · Lower Final",
    stage: "lower",
    round: "Lower Final",
    leftLabel: "Match 6 winner",
    rightLabel: "Upper Final loser",
    waiting: "Waiting for Lower Round 2 and the Upper Final",
    winnerGoes: "Grand Final",
    loserGoes: "Eliminated",
  },
  final: {
    slotKey: "final",
    kind: "final",
    matchNumber: 8,
    bestOf: 3,
    label: "Match 8 · Grand Final",
    stage: "grand",
    round: "Grand Final",
    leftLabel: "Upper Final winner",
    rightLabel: "Lower Final winner",
    waiting: "Waiting for the Upper Final and Lower Final",
    winnerGoes: "Champion",
    loserGoes: "Runner-up",
  },
};

export function isPlayoffBookKind(kind: string | null | undefined) {
  return Boolean(
    kind && (PLAYOFF_BOOK_KINDS as readonly string[]).includes(kind),
  );
}

export function isBracketSlot(slotKey: string | null | undefined): slotKey is BracketSlot {
  return Boolean(slotKey && (BRACKET_SLOTS as readonly string[]).includes(slotKey));
}

export function eliminatedFromSeeds(seeds: GroupSeeds): NamedTeam[] {
  return [seeds.a4, seeds.b4];
}

export function initialPairings(seeds: GroupSeeds): Record<
  "ub1" | "ub2",
  { left: NamedTeam; right: NamedTeam }
> {
  return {
    ub1: { left: seeds.a1, right: seeds.b2 },
    ub2: { left: seeds.b1, right: seeds.a2 },
  };
}

export function unlockedPairings(
  seeds: GroupSeeds | null,
  results: Partial<Record<BracketSlot, SlotResult>>,
): Record<BracketSlot, SlotPairing> {
  const empty = (slot: BracketSlot): SlotPairing => ({
    left: null,
    right: null,
    leftLabel: BRACKET_META[slot].leftLabel,
    rightLabel: BRACKET_META[slot].rightLabel,
  });

  const out = Object.fromEntries(
    BRACKET_SLOTS.map((slot) => [slot, empty(slot)]),
  ) as Record<BracketSlot, SlotPairing>;

  if (seeds) {
    const first = initialPairings(seeds);
    out.ub1 = {
      ...out.ub1,
      left: first.ub1.left,
      right: first.ub1.right,
    };
    out.ub2 = {
      ...out.ub2,
      left: first.ub2.left,
      right: first.ub2.right,
    };
    out.lb1 = { ...out.lb1, left: seeds.a3 };
    out.lb2 = { ...out.lb2, left: seeds.b3 };
  }

  if (results.ub1) {
    out.lb1 = {
      ...out.lb1,
      left: out.lb1.left,
      right: results.ub1.loser,
    };
  }
  if (results.ub2) {
    out.lb2 = {
      ...out.lb2,
      left: out.lb2.left,
      right: results.ub2.loser,
    };
  }
  if (results.lb1 && results.lb2) {
    out.lb3 = {
      ...out.lb3,
      left: results.lb1.winner,
      right: results.lb2.winner,
    };
  }
  if (results.ub1 && results.ub2) {
    out.uf = {
      ...out.uf,
      left: results.ub1.winner,
      right: results.ub2.winner,
    };
  }
  if (results.lb3 && results.uf) {
    out.lb_final = {
      ...out.lb_final,
      left: results.lb3.winner,
      right: results.uf.loser,
    };
  }
  if (results.uf && results.lb_final) {
    out.final = {
      ...out.final,
      left: results.uf.winner,
      right: results.lb_final.winner,
    };
  }

  return out;
}

export function pairingReady(pair: SlotPairing) {
  return Boolean(pair.left && pair.right);
}
