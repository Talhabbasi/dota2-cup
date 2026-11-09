import { matchKillTotals } from "@/lib/match-score";
import { classifyMatchNarrative } from "@/lib/match-narrative";

/** Build list rows on the server. Kept out of the client grid module. */
export function toMatchListView(match: {
  id: string;
  openDotaId?: string;
  duration?: number | null;
  radiantWin?: boolean | null;
  radiantScore?: number | null;
  direScore?: number | null;
  radiantTeam?: { id: string; name: string } | null;
  direTeam?: { id: string; name: string } | null;
  winnerTeam?: { id: string; name: string } | null;
  players: { side: string; kills: number }[];
  createdAt?: Date | string;
  bestOf?: number | null;
  roundLabel?: string | null;
  seasonLabel?: string | null;
  seasonId?: string | null;
}) {
  const totals = matchKillTotals(match.players, {
    radiantScore: match.radiantScore,
    direScore: match.direScore,
  });
  const narrative = classifyMatchNarrative({
    duration: match.duration,
    radiantKills: totals.radiantKills,
    direKills: totals.direKills,
    hasScore: totals.hasScore,
  });
  return {
    id: match.id,
    openDotaId: match.openDotaId,
    duration: match.duration,
    radiantWin: match.radiantWin,
    radiantScore: match.radiantScore,
    direScore: match.direScore,
    radiantTeam: match.radiantTeam,
    direTeam: match.direTeam,
    winnerTeam: match.winnerTeam,
    players: match.players.map((player) => ({ side: player.side, kills: player.kills })),
    createdAt: match.createdAt,
    bestOf: match.bestOf,
    roundLabel: match.roundLabel,
    seasonLabel: match.seasonLabel,
    seasonId: match.seasonId,
    killDiff: Math.abs(totals.radiantKills - totals.direKills),
    totalKills: totals.radiantKills + totals.direKills,
    narrative,
  };
}
