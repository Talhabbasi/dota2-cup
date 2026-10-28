import { MIN_ROSTER } from "@/lib/constants";

/** Auto-assign fills starters only. The substitute slot stays for the auction. */
export const AUTO_ASSIGN_CAP = MIN_ROSTER;

/**
 * Medal ladder used as the rank score. One step per medal, highest first.
 * This cup does not store numeric MMR, so assignment balances these steps.
 * Uncalibrated / unranked sit at the bottom and can still fill a slot.
 */
const DOTA_RANK: Record<string, number> = {
  immortal: 8,
  divine: 7,
  ancient: 6,
  legend: 5,
  archon: 4,
  crusader: 3,
  guardian: 2,
  herald: 1,
  uncalibrated: 0,
};

const PUBG_RANK: Record<string, number> = {
  survivor: 8,
  master: 7,
  diamond: 6,
  crystal: 5,
  platinum: 4,
  gold: 3,
  silver: 2,
  bronze: 1,
  unranked: 0,
};

export function rankScore(medal: string | null | undefined): number | null {
  if (!medal) return null;
  const key = medal.toLowerCase().trim();
  if (key in DOTA_RANK) return DOTA_RANK[key]!;
  if (key in PUBG_RANK) return PUBG_RANK[key]!;
  return null;
}

export type BalancePlayer = { id: string; mmr: number };

export type BalanceTeam = {
  id: string;
  count: number;
  total: number;
  ranked: number;
};

export type BalancePlacement = { playerId: string; teamId: string };

export type BalanceResult = {
  placements: BalancePlacement[];
  spread: number;
};

type MutableTeam = BalanceTeam & { slots: number; assigned: string[] };

function rngFrom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function cloneTeams(teams: MutableTeam[]): MutableTeam[] {
  return teams.map((team) => ({ ...team, assigned: [...team.assigned] }));
}

function averages(open: MutableTeam[], full: BalanceTeam[]): number[] {
  const values: number[] = [];
  for (const team of open) {
    if (team.ranked > 0) values.push(team.total / team.ranked);
  }
  for (const team of full) {
    if (team.ranked > 0) values.push(team.total / team.ranked);
  }
  return values;
}

/** Population standard deviation. Empty and unranked teams are omitted, never treated as 0. */
export function averageSpread(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function leagueSpread(open: MutableTeam[], full: BalanceTeam[]) {
  return averageSpread(averages(open, full));
}

function applyPlayer(team: MutableTeam, player: BalancePlayer, sign: 1 | -1) {
  team.count += sign;
  team.ranked += sign;
  team.total += sign * player.mmr;
  team.slots -= sign;
}

function orderPlayers(players: BalancePlayer[], rng: () => number, shuffled: boolean) {
  const ordered = [...players];
  if (shuffled) {
    for (let i = ordered.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [ordered[i], ordered[j]] = [ordered[j]!, ordered[i]!];
    }
    return ordered;
  }
  ordered.sort((a, b) => b.mmr - a.mmr || (rng() - 0.5));
  for (let i = 0; i < ordered.length - 1; i++) {
    if (ordered[i]!.mmr === ordered[i + 1]!.mmr && rng() < 0.5) {
      [ordered[i], ordered[i + 1]] = [ordered[i + 1]!, ordered[i]!];
    }
  }
  return ordered;
}

function placeGreedy(
  players: BalancePlayer[],
  open: MutableTeam[],
  full: BalanceTeam[],
  rng: () => number,
) {
  for (const player of players) {
    const options = open.filter((team) => team.slots > 0);
    if (options.length === 0) return;
    let best = Number.POSITIVE_INFINITY;
    const scored = options.map((team) => {
      applyPlayer(team, player, 1);
      const score = leagueSpread(open, full);
      applyPlayer(team, player, -1);
      if (score < best) best = score;
      return { team, score };
    });
    const band = Math.max(best * 0.03, 0.05);
    const close = scored.filter((row) => row.score <= best + band);
    const pick = close[Math.floor(rng() * close.length)]!.team;
    applyPlayer(pick, player, 1);
    pick.assigned.push(player.id);
  }
}

function assignedSet(open: MutableTeam[]) {
  const ids = new Set<string>();
  for (const team of open) {
    for (const id of team.assigned) ids.add(id);
  }
  return ids;
}

function improve(
  open: MutableTeam[],
  full: BalanceTeam[],
  players: BalancePlayer[],
  rng: () => number,
) {
  const byId = new Map(players.map((player) => [player.id, player]));
  for (let step = 0; step < 64; step++) {
    const before = leagueSpread(open, full);
    const roll = rng();
    const hosts = open.filter((team) => team.assigned.length > 0);
    if (hosts.length === 0) return;

    if (roll < 0.4 && hosts.length > 1) {
      const a = hosts[Math.floor(rng() * hosts.length)]!;
      const others = hosts.filter((team) => team !== a);
      const b = others[Math.floor(rng() * others.length)]!;
      const ai = Math.floor(rng() * a.assigned.length);
      const bi = Math.floor(rng() * b.assigned.length);
      const ap = byId.get(a.assigned[ai]!)!;
      const bp = byId.get(b.assigned[bi]!)!;
      a.assigned[ai] = bp.id;
      b.assigned[bi] = ap.id;
      a.total += bp.mmr - ap.mmr;
      b.total += ap.mmr - bp.mmr;
      if (leagueSpread(open, full) < before - 0.01) continue;
      a.assigned[ai] = ap.id;
      b.assigned[bi] = bp.id;
      a.total += ap.mmr - bp.mmr;
      b.total += bp.mmr - ap.mmr;
      continue;
    }

    if (roll < 0.75) {
      const idle = players.filter((player) => !assignedSet(open).has(player.id));
      if (idle.length === 0) continue;
      const team = hosts[Math.floor(rng() * hosts.length)]!;
      const index = Math.floor(rng() * team.assigned.length);
      const current = byId.get(team.assigned[index]!)!;
      const next = idle[Math.floor(rng() * idle.length)]!;
      team.assigned[index] = next.id;
      team.total += next.mmr - current.mmr;
      if (leagueSpread(open, full) < before - 0.01) continue;
      team.assigned[index] = current.id;
      team.total += current.mmr - next.mmr;
      continue;
    }

    const dests = open.filter((team) => team.slots > 0);
    if (dests.length === 0) continue;
    const team = hosts[Math.floor(rng() * hosts.length)]!;
    const dest = dests[Math.floor(rng() * dests.length)]!;
    if (dest === team) continue;
    const index = Math.floor(rng() * team.assigned.length);
    const player = byId.get(team.assigned[index]!)!;
    team.assigned.splice(index, 1);
    applyPlayer(team, player, -1);
    applyPlayer(dest, player, 1);
    dest.assigned.push(player.id);
    if (leagueSpread(open, full) < before - 0.01) continue;
    dest.assigned.pop();
    applyPlayer(dest, player, -1);
    applyPlayer(team, player, 1);
    team.assigned.splice(index, 0, player.id);
  }
}

function runOnce(
  players: BalancePlayer[],
  openSeed: MutableTeam[],
  full: BalanceTeam[],
  rng: () => number,
  shuffled: boolean,
) {
  const open = cloneTeams(openSeed);
  placeGreedy(orderPlayers(players, rng, shuffled), open, full, rng);
  improve(open, full, players, rng);
  return { open, spread: leagueSpread(open, full) };
}

/**
 * Fill as many open slots as possible while keeping final team rank averages close.
 * Restarts that land in the same fairness band are chosen at random so Regenerate
 * can differ without jumping to an obviously lopsided draw.
 */
export function buildBalancedAssignment(
  players: BalancePlayer[],
  teams: BalanceTeam[],
  seed: number,
): BalanceResult {
  const rng = rngFrom(seed);
  const openSeed: MutableTeam[] = teams
    .filter((team) => team.count < AUTO_ASSIGN_CAP)
    .map((team) => ({
      ...team,
      slots: AUTO_ASSIGN_CAP - team.count,
      assigned: [],
    }));
  const full = teams.filter((team) => team.count >= AUTO_ASSIGN_CAP);
  if (players.length === 0 || openSeed.every((team) => team.slots <= 0)) {
    return { placements: [], spread: leagueSpread(openSeed, full) };
  }

  const runs: { open: MutableTeam[]; spread: number }[] = [];
  for (let i = 0; i < 20; i++) {
    runs.push(runOnce(players, openSeed, full, rng, i % 2 === 1));
  }
  const best = Math.min(...runs.map((run) => run.spread));
  const band = Math.max(best * 0.08, 0.08);
  const fair = runs.filter((run) => run.spread <= best + band);
  const chosen = fair[Math.floor(rng() * fair.length)]!;
  const placements: BalancePlacement[] = [];
  for (const team of chosen.open) {
    for (const playerId of team.assigned) {
      placements.push({ playerId, teamId: team.id });
    }
  }
  return { placements, spread: chosen.spread };
}
