import { prisma } from "./prisma";
import { publicPlayerWhere } from "./dummy";
import { formatPoints } from "./constants";
import { getPredictionLeaderboard } from "./predictions";
import { currentSeasonId } from "./seasons";

export type PlayerInsightAward = {
  playerId: string | null;
  name: string;
  teamName: string | null;
  value: number;
  valueLabel: string;
  detail?: string;
  /** Roster cup games vs guest stand-in games — totals never merge across these. */
  kind: "roster" | "standin";
};

export type PlayerOfTournament = PlayerInsightAward & {
  kills: number;
  assists: number;
  deaths: number;
  games: number;
  /** Weighted score used for ranking (assists count heavily). */
  score: number;
};

export type PublicPlayerInsight = {
  mostKills: PlayerInsightAward | null;
  mostAssists: PlayerInsightAward | null;
  mostDeaths: PlayerInsightAward | null;
  mostTeamKills: PlayerInsightAward | null;
  mostTeamDeaths: PlayerInsightAward | null;
  highestBid: PlayerInsightAward | null;
  mostCorrectPredictions: PlayerInsightAward | null;
  predictionsRevealed: boolean;
  playerOfTournament: PlayerOfTournament | null;
};

type Totals = {
  key: string;
  playerId: string | null;
  name: string;
  teamName: string | null;
  kills: number;
  assists: number;
  deaths: number;
  games: number;
  kind: "roster" | "standin";
};

/** Assists outweigh kills so supports can claim player of the tournament. */
export function tournamentImpactScore(input: {
  kills: number;
  assists: number;
  deaths: number;
}) {
  return input.kills * 1 + input.assists * 1.45 - input.deaths * 0.8;
}

function pickTopByValue<T extends { value: number }>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => b.value - a.value)[0] ?? null;
}

function toAward(
  row: Totals,
  value: number,
  valueLabel: string,
  detail?: string,
): PlayerInsightAward {
  return {
    playerId: row.playerId,
    name: row.name,
    teamName: row.teamName,
    value,
    valueLabel,
    detail,
    kind: row.kind,
  };
}

function pickPot(totals: Totals[]): (Totals & { score: number }) | null {
  if (totals.length === 0) return null;
  return (
    [...totals]
      .map((row) => ({ ...row, score: tournamentImpactScore(row) }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.assists !== a.assists) return b.assists - a.assists;
        if (b.kills !== a.kills) return b.kills - a.kills;
        if (a.deaths !== b.deaths) return a.deaths - b.deaths;
        return b.games - a.games;
      })[0] ?? null
  );
}

export async function getPublicPlayerInsight(): Promise<PublicPlayerInsight> {
  const seasonId = await currentSeasonId();

  const [seats, topLot, board] = await Promise.all([
    prisma.matchPlayer.findMany({
      where: {
        match: { seasonId },
        unknown: false,
      },
      select: {
        kills: true,
        assists: true,
        deaths: true,
        asStandIn: true,
        boardName: true,
        side: true,
        playerId: true,
        match: {
          select: {
            radiantTeam: { select: { name: true } },
            direTeam: { select: { name: true } },
          },
        },
        player: {
          select: {
            id: true,
            steamName: true,
            discordId: true,
            team: { select: { name: true } },
          },
        },
      },
    }),
    prisma.auctionLot.findFirst({
      where: {
        seasonId,
        status: "sold",
        soldPrice: { not: null },
        player: publicPlayerWhere,
      },
      orderBy: { soldPrice: "desc" },
      select: {
        soldPrice: true,
        player: {
          select: {
            id: true,
            steamName: true,
            team: { select: { name: true } },
          },
        },
        team: { select: { name: true } },
      },
    }),
    getPredictionLeaderboard(null),
  ]);

  /** One map, but roster vs stand-in (+ team) stay separate keys so they never merge. */
  const byKey = new Map<string, Totals>();
  const teamKills = new Map<string, { name: string; kills: number; deaths: number }>();

  for (const seat of seats) {
    const matchTeam =
      seat.side === "radiant"
        ? seat.match.radiantTeam?.name
        : seat.match.direTeam?.name;
    const teamName = matchTeam ?? null;

    if (teamName) {
      const teamKey = teamName.toLowerCase();
      const team = teamKills.get(teamKey) ?? {
        name: teamName,
        kills: 0,
        deaths: 0,
      };
      team.kills += seat.kills;
      team.deaths += seat.deaths;
      team.name = teamName;
      teamKills.set(teamKey, team);
    }

    if (seat.asStandIn) {
      const name =
        seat.player?.steamName?.trim() ||
        seat.boardName?.trim() ||
        "Stand-in";
      const identity = seat.playerId
        ? `pid:${seat.playerId}`
        : `name:${name.toLowerCase()}`;
      const key = `standin:${identity}:${(teamName ?? "none").toLowerCase()}`;
      const cur = byKey.get(key) ?? {
        key,
        playerId: seat.playerId,
        name,
        teamName,
        kills: 0,
        assists: 0,
        deaths: 0,
        games: 0,
        kind: "standin" as const,
      };
      cur.kills += seat.kills;
      cur.assists += seat.assists;
      cur.deaths += seat.deaths;
      cur.games += 1;
      cur.name = name;
      cur.teamName = teamName;
      byKey.set(key, cur);
      continue;
    }

    if (!seat.playerId || !seat.player) continue;
    if (
      seat.player.discordId.startsWith("test-dummy-") ||
      seat.player.discordId.startsWith("test-dummy-team-")
    ) {
      continue;
    }

    const key = `roster:${seat.playerId}:${(teamName ?? seat.player.team?.name ?? "none").toLowerCase()}`;
    const cur = byKey.get(key) ?? {
      key,
      playerId: seat.playerId,
      name: seat.player.steamName,
      teamName: teamName ?? seat.player.team?.name ?? null,
      kills: 0,
      assists: 0,
      deaths: 0,
      games: 0,
      kind: "roster" as const,
    };
    cur.kills += seat.kills;
    cur.assists += seat.assists;
    cur.deaths += seat.deaths;
    cur.games += 1;
    cur.name = seat.player.steamName;
    cur.teamName = teamName ?? seat.player.team?.name ?? null;
    byKey.set(key, cur);
  }

  const entries = [...byKey.values()];
  const teams = [...teamKills.values()];

  const mostKillsRow = pickTopByValue(
    entries.map((row) => ({ ...row, value: row.kills })),
  );
  const mostAssistsRow = pickTopByValue(
    entries.map((row) => ({ ...row, value: row.assists })),
  );
  const mostDeathsRow = pickTopByValue(
    entries.map((row) => ({ ...row, value: row.deaths })),
  );
  const mostTeamKillsRow = pickTopByValue(
    teams.map((row) => ({ ...row, value: row.kills })),
  );
  const mostTeamDeathsRow = pickTopByValue(
    teams.map((row) => ({ ...row, value: row.deaths })),
  );
  const pot = pickPot(entries);

  const mostCorrect =
    board.revealed && board.rows.length > 0
      ? [...board.rows].sort((a, b) => {
          if (b.correct !== a.correct) return b.correct - a.correct;
          if (b.points !== a.points) return b.points - a.points;
          return a.name.localeCompare(b.name);
        })[0]
      : null;

  return {
    mostKills: mostKillsRow
      ? toAward(
          mostKillsRow,
          mostKillsRow.kills,
          `${mostKillsRow.kills} kills`,
          mostKillsRow.kind === "standin"
            ? `Stand-in · ${mostKillsRow.games} game${mostKillsRow.games === 1 ? "" : "s"}`
            : `${mostKillsRow.games} game${mostKillsRow.games === 1 ? "" : "s"}`,
        )
      : null,
    mostAssists: mostAssistsRow
      ? toAward(
          mostAssistsRow,
          mostAssistsRow.assists,
          `${mostAssistsRow.assists} assists`,
          mostAssistsRow.kind === "standin"
            ? "Stand-in · support impact"
            : "Support impact",
        )
      : null,
    mostDeaths: mostDeathsRow
      ? toAward(
          mostDeathsRow,
          mostDeathsRow.deaths,
          `${mostDeathsRow.deaths} deaths`,
          mostDeathsRow.kind === "standin"
            ? `Stand-in · ${mostDeathsRow.games} game${mostDeathsRow.games === 1 ? "" : "s"}`
            : `${mostDeathsRow.games} game${mostDeathsRow.games === 1 ? "" : "s"}`,
        )
      : null,
    mostTeamKills: mostTeamKillsRow
      ? {
          playerId: null,
          name: mostTeamKillsRow.name,
          teamName: mostTeamKillsRow.name,
          value: mostTeamKillsRow.kills,
          valueLabel: `${mostTeamKillsRow.kills} kills`,
          detail: "All seats for this franchise",
          kind: "roster",
        }
      : null,
    mostTeamDeaths: mostTeamDeathsRow
      ? {
          playerId: null,
          name: mostTeamDeathsRow.name,
          teamName: mostTeamDeathsRow.name,
          value: mostTeamDeathsRow.deaths,
          valueLabel: `${mostTeamDeathsRow.deaths} deaths`,
          detail: "All seats for this franchise",
          kind: "roster",
        }
      : null,
    highestBid: topLot
      ? {
          playerId: topLot.player.id,
          name: topLot.player.steamName,
          teamName: topLot.team?.name ?? topLot.player.team?.name ?? null,
          value: topLot.soldPrice ?? 0,
          valueLabel: formatPoints(topLot.soldPrice ?? 0),
          detail: "Highest auction sale",
          kind: "roster",
        }
      : null,
    mostCorrectPredictions: mostCorrect
      ? {
          playerId: mostCorrect.playerId,
          name: mostCorrect.name,
          teamName: null,
          value: mostCorrect.correct,
          valueLabel: `${mostCorrect.correct} correct`,
          detail: `${mostCorrect.points} pts · ${mostCorrect.picks} picks`,
          kind: "roster",
        }
      : null,
    predictionsRevealed: board.revealed,
    playerOfTournament: pot
      ? {
          ...toAward(
            pot,
            Math.round(pot.score * 10) / 10,
            `Impact ${Math.round(pot.score * 10) / 10}`,
            pot.kind === "standin"
              ? "Stand-in · kills + assists − deaths (assists weighted higher)"
              : "Kills + assists − deaths (assists weighted higher)",
          ),
          kills: pot.kills,
          assists: pot.assists,
          deaths: pot.deaths,
          games: pot.games,
          score: pot.score,
        }
      : null,
  };
}
