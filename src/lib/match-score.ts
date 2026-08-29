export type MatchPlayerKills = {
  side: string;
  kills: number;
};

export function matchKillTotals(players: MatchPlayerKills[] | undefined) {
  let radiantKills = 0;
  let direKills = 0;
  if (!players?.length) {
    return { radiantKills, direKills, hasScore: false };
  }
  for (const p of players) {
    if (p.side === "radiant") radiantKills += p.kills;
    else if (p.side === "dire") direKills += p.kills;
  }
  return {
    radiantKills,
    direKills,
    hasScore: radiantKills > 0 || direKills > 0,
  };
}

export function formatKillScore(radiantKills: number, direKills: number) {
  return `${radiantKills}:${direKills}`;
}
