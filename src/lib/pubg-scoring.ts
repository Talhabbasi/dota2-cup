/** 2026 PUBG Mobile World Cup and PUBG PC Esports World Cup table. */
const PLACEMENT: Record<number, number> = {
  1: 10,
  2: 6,
  3: 5,
  4: 4,
  5: 3,
  6: 2,
  7: 1,
  8: 1,
};

export function placementPoints(place: number) {
  if (!Number.isInteger(place) || place < 1 || place > 16) return 0;
  return PLACEMENT[place] ?? 0;
}

/** Match points = placement points + 1 point per kill. */
export function matchPoints(place: number, kills: number) {
  const safeKills = Number.isInteger(kills) && kills > 0 ? kills : 0;
  return placementPoints(place) + safeKills;
}

export type PubgStandingRow = {
  teamId: string;
  name: string;
  wwcd: number;
  placementPoints: number;
  killPoints: number;
  total: number;
  matches: number;
  /** Lower is better. Null when the team has no games. */
  latestPlace: number | null;
};

export function rankPubgStandings(
  rows: PubgStandingRow[],
): PubgStandingRow[] {
  return [...rows].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.wwcd !== a.wwcd) return b.wwcd - a.wwcd;
    if (b.placementPoints !== a.placementPoints) {
      return b.placementPoints - a.placementPoints;
    }
    if (b.killPoints !== a.killPoints) return b.killPoints - a.killPoints;
    const aPlace = a.latestPlace ?? 99;
    const bPlace = b.latestPlace ?? 99;
    return aPlace - bPlace;
  });
}
