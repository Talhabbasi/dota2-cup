export const CUP_GAME = {
  DOTA: "DOTA",
  PUBG: "PUBG",
} as const;

export type CupGame = (typeof CUP_GAME)[keyof typeof CUP_GAME];

export const PUBG_MODE = {
  SOLO: "SOLO",
  DUO: "DUO",
  SQUAD: "SQUAD",
} as const;

export type PubgMode = (typeof PUBG_MODE)[keyof typeof PUBG_MODE];

export const PUBG_MAPS = [
  "Erangel",
  "Miramar",
  "Sanhok",
  "Vikendi",
  "Rondo",
] as const;

const PUBG_SIZE: Record<PubgMode, number> = {
  SOLO: 1,
  DUO: 2,
  SQUAD: 4,
};

export function parseCupGame(value: string | null | undefined): CupGame {
  return value === CUP_GAME.PUBG ? CUP_GAME.PUBG : CUP_GAME.DOTA;
}

export function parsePubgMode(value: string | null | undefined): PubgMode {
  if (value === PUBG_MODE.SOLO || value === PUBG_MODE.DUO) return value;
  return PUBG_MODE.SQUAD;
}

export function isPubgSeason(season: object | null | undefined) {
  if (!season || !("game" in season)) return false;
  return parseCupGame((season as { game?: string | null }).game) === CUP_GAME.PUBG;
}

export type RosterRules = {
  game: CupGame;
  pubgMode: PubgMode | null;
  min: number;
  max: number;
  subs: number;
  /** Per person. */
  entryFeePkr: number;
  /** Exact team total. Subs are free only on Dota. */
  teamFeePkr: number;
  label: string;
};

export function rosterRules(
  season: { game?: string | null; pubgMode?: string | null } | null | undefined,
): RosterRules {
  const fee = 1000;
  if (!isPubgSeason(season)) {
    return {
      game: CUP_GAME.DOTA,
      pubgMode: null,
      min: 5,
      max: 7,
      subs: 2,
      entryFeePkr: fee,
      teamFeePkr: 5000,
      label: "5 starters + 2 subs",
    };
  }
  const mode = parsePubgMode(season?.pubgMode);
  const size = PUBG_SIZE[mode];
  const label =
    mode === PUBG_MODE.SOLO ? "Solo" : mode === PUBG_MODE.DUO ? "Duo" : "Squad";
  return {
    game: CUP_GAME.PUBG,
    pubgMode: mode,
    min: size,
    max: size,
    subs: 0,
    entryFeePkr: fee,
    teamFeePkr: size * fee,
    label: `${label} · ${size}`,
  };
}

export function pubgModeLabel(mode: string | null | undefined) {
  const parsed = parsePubgMode(mode);
  if (parsed === PUBG_MODE.SOLO) return "Solo";
  if (parsed === PUBG_MODE.DUO) return "Duo";
  return "Squad";
}
