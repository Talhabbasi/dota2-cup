import { BRACKET_META, isBracketSlot } from "@/lib/playoff-tree";

/** Short series line for a recorded map, e.g. "Bo1 · UB" or "Bo3 · Grand Final · Game 2". */
export function seriesContextLabel(input: {
  kind?: string | null;
  slotKey?: string | null;
  bestOf?: number | null;
  gameNumber?: number | null;
}): string {
  const bestOf = input.bestOf && input.bestOf > 0 ? input.bestOf : 1;
  const round = roundLabel(input.kind, input.slotKey);
  const parts = [`Bo${bestOf}`];
  if (round) parts.push(round);
  if (bestOf > 1 && input.gameNumber && input.gameNumber > 0) {
    parts.push(`Game ${input.gameNumber}`);
  }
  return parts.join(" · ");
}

function roundLabel(kind?: string | null, slotKey?: string | null) {
  if (slotKey && isBracketSlot(slotKey)) {
    const meta = BRACKET_META[slotKey];
    if (meta.stage === "grand") return "Grand Final";
    if (meta.stage === "lower") return "Lower bracket · Elimination";
    if (meta.slotKey === "uf") return "UB Final";
    return "UB";
  }
  switch (kind) {
    case "group":
    case "regular":
      return "Group";
    case "ub":
      return "UB";
    case "ub_final":
      return "UB Final";
    case "lb":
      return "Lower bracket · Elimination";
    case "lb_final":
      return "Lower Final";
    case "final":
      return "Grand Final";
    case "adv":
      return "Advancement";
    default:
      return null;
  }
}
