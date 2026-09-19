export type MatchPlayerKills = {
  side: string;
  kills: number;
};

export function matchKillTotals(
  players: MatchPlayerKills[] | undefined,
  official?: { radiantScore?: number | null; direScore?: number | null },
) {
  let radiantKills = 0;
  let direKills = 0;
  if (players?.length) {
    for (const p of players) {
      if (p.side === "radiant") radiantKills += p.kills;
      else if (p.side === "dire") direKills += p.kills;
    }
  }
  if (official?.radiantScore != null) radiantKills = official.radiantScore;
  if (official?.direScore != null) direKills = official.direScore;
  return {
    radiantKills,
    direKills,
    hasScore: radiantKills > 0 || direKills > 0,
  };
}

export function formatKillScore(radiantKills: number, direKills: number) {
  return `${radiantKills}:${direKills}`;
}
