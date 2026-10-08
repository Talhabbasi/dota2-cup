import { PUBG_MAPS, isPubgSeason, rosterRules } from "./games";
import { prisma } from "./prisma";
import {
  matchPoints,
  placementPoints,
  rankPubgStandings,
  type PubgStandingRow,
} from "./pubg-scoring";
import { getLiveSeason } from "./seasons";

export type LobbyPlayerLine = {
  name: string;
  kills: number;
  damage: number;
  knocks: number;
  playerId?: string | null;
};

function cleanMap(map: string) {
  const trimmed = map.trim();
  const known = PUBG_MAPS.find(
    (item) => item.toLowerCase() === trimmed.toLowerCase(),
  );
  if (!known) {
    throw new Error(
      `Map must be one of: ${PUBG_MAPS.join(", ")}.`,
    );
  }
  return known;
}

function whole(value: number, label: string, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

/** "Name, kills, damage" or "Name kills damage" per line. */
export function parseLobbyPlayerLines(raw: string): LobbyPlayerLine[] {
  const lines = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line) => {
    const parts = line.split(/[,|]+/).map((part) => part.trim());
    const bits = parts.length >= 2 ? parts : line.split(/\s+/);
    if (bits.length < 2) {
      throw new Error(
        `Each player line needs a name and kills. Example: Ali, 4, 900`,
      );
    }
    const kills = Number(bits[bits.length - 2] ?? bits[1]);
    const damage = bits.length >= 3 ? Number(bits[bits.length - 1]) : 0;
    const nameParts =
      bits.length >= 3 ? bits.slice(0, -2) : bits.slice(0, 1);
    const name = nameParts.join(" ").trim();
    if (!name) throw new Error("A player line is missing a name.");
    return {
      name,
      kills: whole(kills, `${name} kills`, 0, 99),
      damage: whole(Number.isFinite(damage) ? damage : 0, `${name} damage`, 0, 99999),
      knocks: 0,
    };
  });
}

export async function recordPubgTeamResult(input: {
  seasonId?: string | null;
  lobbyId?: string | null;
  label?: string | null;
  map?: string | null;
  playedAt?: Date | null;
  teamName: string;
  placement: number;
  kills: number;
  players?: LobbyPlayerLine[];
  sourceImagePath?: string | null;
}) {
  const season = input.seasonId
    ? await prisma.season.findUnique({ where: { id: input.seasonId } })
    : await getLiveSeason();
  if (!season || !isPubgSeason(season)) {
    throw new Error("Lobby results are only for a PUBG season.");
  }
  const rules = rosterRules(season);
  const placement = whole(input.placement, "Placement", 1, 16);
  const kills = whole(input.kills, "Team kills", 0, 99);
  const teamName = input.teamName.trim();
  if (!teamName) throw new Error("Team name is required.");

  const team = await prisma.team.findFirst({
    where: {
      seasonId: season.id,
      name: { equals: teamName, mode: "insensitive" },
    },
    include: {
      seasonPlayers: {
        include: { player: { select: { id: true, steamName: true, pubgName: true } } },
      },
    },
  });
  if (!team) throw new Error(`No team named ${teamName} in this season.`);

  const players = input.players ?? [];
  if (players.length > rules.max) {
    throw new Error(`${rules.label} allows ${rules.max} players on a result.`);
  }
  const playerKillSum = players.reduce((sum, row) => sum + row.kills, 0);
  if (players.length > 0 && playerKillSum !== kills) {
    throw new Error(
      `Player kills add up to ${playerKillSum}, but the team total is ${kills}.`,
    );
  }

  const playedAt = input.playedAt ?? new Date();
  const map = input.map?.trim() ? cleanMap(input.map) : null;

  return prisma.$transaction(async (tx) => {
    let lobby = input.lobbyId
      ? await tx.pubgLobby.findFirst({
          where: { id: input.lobbyId, seasonId: season.id },
        })
      : null;
    if (!lobby && input.label?.trim()) {
      lobby = await tx.pubgLobby.findFirst({
        where: {
          seasonId: season.id,
          label: { equals: input.label.trim(), mode: "insensitive" },
        },
        orderBy: { playedAt: "desc" },
      });
    }
    if (!lobby) {
      if (!map) throw new Error("Map is required when starting a lobby.");
      lobby = await tx.pubgLobby.create({
        data: {
          seasonId: season.id,
          map,
          playedAt,
          label: input.label?.trim() || "",
          status: "played",
          sourceImagePath: input.sourceImagePath ?? null,
        },
      });
    } else {
      const patch: { status?: string; sourceImagePath?: string } = {};
      if (lobby.status !== "played") patch.status = "played";
      if (input.sourceImagePath) patch.sourceImagePath = input.sourceImagePath;
      if (patch.status || patch.sourceImagePath) {
        await tx.pubgLobby.update({ where: { id: lobby.id }, data: patch });
      }
    }

    const taken = await tx.pubgLobbyTeam.findFirst({
      where: { lobbyId: lobby.id, placement, teamId: { not: team.id } },
    });
    if (taken) {
      throw new Error(`Place ${placement} is already taken in this lobby.`);
    }

    const row = await tx.pubgLobbyTeam.upsert({
      where: { lobbyId_teamId: { lobbyId: lobby.id, teamId: team.id } },
      create: {
        lobbyId: lobby.id,
        teamId: team.id,
        placement,
        kills,
      },
      update: { placement, kills },
    });

    if (players.length > 0) {
      await tx.pubgLobbyPlayer.deleteMany({ where: { lobbyTeamId: row.id } });
      await tx.pubgLobbyPlayer.createMany({
        data: players.map((player) => {
          const match = team.seasonPlayers.find((member) => {
            const names = [member.player.pubgName, member.player.steamName]
              .filter(Boolean)
              .map((name) => name!.toLowerCase());
            return names.includes(player.name.toLowerCase());
          });
          return {
            lobbyTeamId: row.id,
            playerId: player.playerId ?? match?.player.id ?? null,
            name: player.name,
            kills: player.kills,
            damage: player.damage,
            knocks: player.knocks,
          };
        }),
      });
    }

    return { lobbyId: lobby.id, teamId: team.id, points: matchPoints(placement, kills) };
  });
}

export async function schedulePubgLobby(input: {
  seasonId: string;
  label: string;
  map: string;
  playedAt: Date;
  teamIds: string[];
}) {
  const season = await prisma.season.findUnique({ where: { id: input.seasonId } });
  if (!season || !isPubgSeason(season)) {
    throw new Error("PUBG lobbies can only be booked on a PUBG season.");
  }
  const label = input.label.trim();
  if (!label) throw new Error("Lobby label is required.");
  if (Number.isNaN(input.playedAt.getTime())) {
    throw new Error("Start time is required.");
  }
  const teamIds = [...new Set(input.teamIds.map((id) => id.trim()).filter(Boolean))];
  if (teamIds.length < 2) {
    throw new Error("Pick at least two teams from this season.");
  }
  const teams = await prisma.team.findMany({
    where: { seasonId: season.id, id: { in: teamIds } },
    select: { id: true, name: true },
  });
  if (teams.length !== teamIds.length) {
    throw new Error("Every team must belong to this season.");
  }
  const map = cleanMap(input.map);
  return prisma.pubgLobby.create({
    data: {
      seasonId: season.id,
      map,
      playedAt: input.playedAt,
      label,
      status: "scheduled",
      teams: {
        create: teams.map((team) => ({
          teamId: team.id,
          kills: 0,
        })),
      },
    },
    include: { teams: { include: { team: { select: { name: true } } } } },
  });
}

export async function listPubgLobbies(seasonId: string) {
  return prisma.pubgLobby.findMany({
    where: { seasonId },
    orderBy: { playedAt: "asc" },
    include: {
      teams: {
        orderBy: { placement: "asc" },
        include: {
          team: { select: { id: true, name: true } },
          players: { orderBy: { kills: "desc" } },
        },
      },
    },
  });
}

export async function pubgStandings(seasonId: string): Promise<PubgStandingRow[]> {
  const [teams, lobbies] = await Promise.all([
    prisma.team.findMany({
      where: { seasonId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.pubgLobby.findMany({
      where: { seasonId },
      orderBy: { playedAt: "asc" },
      include: { teams: true },
    }),
  ]);

  const byTeam = new Map<string, PubgStandingRow>();
  for (const team of teams) {
    byTeam.set(team.id, {
      teamId: team.id,
      name: team.name,
      wwcd: 0,
      placementPoints: 0,
      killPoints: 0,
      total: 0,
      matches: 0,
      latestPlace: null,
    });
  }

  for (const lobby of lobbies) {
    for (const result of lobby.teams) {
      if (lobby.status === "scheduled" || result.placement == null) continue;
      const row = byTeam.get(result.teamId);
      if (!row) continue;
      const placePts = placementPoints(result.placement);
      row.matches += 1;
      row.wwcd += result.placement === 1 ? 1 : 0;
      row.placementPoints += placePts;
      row.killPoints += result.kills;
      row.total += placePts + result.kills;
      row.latestPlace = result.placement;
    }
  }

  return rankPubgStandings([...byTeam.values()]);
}

export async function pubgPlayerAwards(seasonId: string) {
  const rows = await prisma.pubgLobbyPlayer.findMany({
    where: { lobbyTeam: { lobby: { seasonId } } },
    select: {
      name: true,
      playerId: true,
      kills: true,
      damage: true,
      lobbyTeam: { select: { team: { select: { name: true } }, placement: true } },
    },
  });
  type Acc = {
    name: string;
    playerId: string | null;
    teamName: string | null;
    kills: number;
    damage: number;
    wwcd: number;
  };
  const map = new Map<string, Acc>();
  for (const row of rows) {
    const key = row.playerId ?? row.name.toLowerCase();
    const current = map.get(key) ?? {
      name: row.name,
      playerId: row.playerId,
      teamName: row.lobbyTeam.team.name,
      kills: 0,
      damage: 0,
      wwcd: 0,
    };
    current.kills += row.kills;
    current.damage += row.damage;
    if (row.lobbyTeam.placement === 1) current.wwcd += 1;
    map.set(key, current);
  }
  const all = [...map.values()];
  const top = (pick: (row: Acc) => number) =>
    [...all].sort((a, b) => pick(b) - pick(a))[0] ?? null;
  return {
    mostKills: top((row) => row.kills),
    mostDamage: top((row) => row.damage),
    mostChickenDinners: top((row) => row.wwcd),
  };
}
