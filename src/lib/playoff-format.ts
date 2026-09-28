/**
 * Playoff shape from Admin → Seasons team count.
 *
 * 8 teams → 2×4 (classic): 4th eliminated; A3/B3 wait for upper losers.
 * 10 teams → 2×5: 5th eliminated; top 4 advance; A3 vs B4 / B3 vs A4
 *   play into lower (lb0), then same upper/lower pattern as classic.
 * 12 teams → 2×6: same idea as 10 (last out; top 4 into bracket).
 */

import { getLiveSeason } from "./seasons";
import { ALLOWED_TEAM_COUNTS } from "./season-constants";

export type PlayoffFormat = {
  teamCount: number;
  groupSize: number;
  /** Games each team plays in group round-robin. */
  gamesPerTeam: number;
  /** Matches per group = C(groupSize, 2). */
  matchesPerGroup: number;
  /** 1-based place eliminated after groups (4 for size 4, 5 for size 5). */
  eliminatePlace: number;
  /** How many teams per group advance into the playoff bracket. */
  advancePerGroup: number;
  /** Lower play-in (A3 vs B4, B3 vs A4) before facing upper losers. */
  hasLowerPlayIn: boolean;
};

export function playoffFormatFromTeamCount(teamCount: number): PlayoffFormat {
  const n =
    (ALLOWED_TEAM_COUNTS as readonly number[]).includes(teamCount)
      ? teamCount
      : 8;
  const groupSize = Math.floor(n / 2);
  const advancePerGroup = Math.min(4, groupSize);
  return {
    teamCount: n,
    groupSize,
    gamesPerTeam: groupSize - 1,
    matchesPerGroup: (groupSize * (groupSize - 1)) / 2,
    eliminatePlace: groupSize,
    advancePerGroup,
    hasLowerPlayIn: groupSize >= 5,
  };
}

export async function getLivePlayoffFormat(): Promise<PlayoffFormat> {
  const live = await getLiveSeason();
  return playoffFormatFromTeamCount(live?.teamCount ?? 8);
}

/** All unordered pairs for a round-robin. */
export function roundRobinPairs<T>(teams: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      pairs.push([teams[i], teams[j]]);
    }
  }
  return pairs;
}
