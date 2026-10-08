export const STARTING_PURSE = 20_000;
export const MAX_CAPTAINS = 15;
export const BID_INCREMENT = 100;
export const BID_CLOCK_SECONDS = 30;
export const MIN_ROSTER = 5;
export const MAX_ROSTER = 7;
export const MAX_SUBS = 2;

export const MEDALS = [
  "immortal",
  "divine",
  "ancient",
  "legend",
  "archon",
  "crusader",
  "guardian",
  "herald",
  "uncalibrated",
] as const;

export type Medal = (typeof MEDALS)[number];

/** PUBG Mobile classic tiers, highest first. Crown and below also have divisions V–I. */
export const PUBG_MEDALS = [
  "conqueror",
  "challenger",
  "master",
  "ace",
  "crown",
  "diamond",
  "platinum",
  "gold",
  "silver",
  "bronze",
] as const;

export type PubgMedal = (typeof PUBG_MEDALS)[number];

export const BASE_PRICE: Record<Medal, number> = {
  immortal: 5000,
  divine: 4000,
  ancient: 3000,
  legend: 2000,
  archon: 1000,
  crusader: 1000,
  guardian: 1000,
  herald: 1000,
  uncalibrated: 1000,
};

export const PUBG_BASE_PRICE: Record<PubgMedal, number> = {
  conqueror: 4000,
  challenger: 3500,
  master: 3000,
  ace: 2500,
  crown: 2000,
  diamond: 1500,
  platinum: 1200,
  gold: 1000,
  silver: 800,
  bronze: 600,
};

export const ROLES = [
  "safelane",
  "mid",
  "offlane",
  "soft_support",
  "hard_support",
  "sub",
] as const;

export type Role = (typeof ROLES)[number];

export const STARTING_ROLES = [
  "safelane",
  "mid",
  "offlane",
  "soft_support",
  "hard_support",
] as const;

export type StartingRole = (typeof STARTING_ROLES)[number];

export const FLEX = "flex";
export type PlayerRole = Role | typeof FLEX;

export const ROLE_LABELS: Record<PlayerRole, string> = {
  safelane: "Safelane",
  mid: "Mid",
  offlane: "Offlane",
  soft_support: "Soft support",
  hard_support: "Hard support",
  sub: "Substitute",
  flex: "Flex / any role",
};

export const ROLE_SHORT: Record<PlayerRole, string> = {
  safelane: "1",
  mid: "2",
  offlane: "3",
  soft_support: "4",
  hard_support: "5",
  sub: "SUB",
  flex: "FLEX",
};

export function formatPoints(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export const MEDAL_LABELS: Record<Medal, string> = {
  immortal: "Immortal",
  divine: "Divine",
  ancient: "Ancient",
  legend: "Legend",
  archon: "Archon",
  crusader: "Crusader",
  guardian: "Guardian",
  herald: "Herald",
  uncalibrated: "Uncalibrated",
};

export const PUBG_MEDAL_LABELS: Record<PubgMedal, string> = {
  conqueror: "Conqueror",
  challenger: "Challenger",
  master: "Master",
  ace: "Ace",
  crown: "Crown",
  diamond: "Diamond",
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
};

export function medalsForGame(game: string | null | undefined) {
  return game === "PUBG" ? PUBG_MEDALS : MEDALS;
}

export function labelForMedal(medal: string): string {
  return (
    MEDAL_LABELS[medal as Medal] ??
    PUBG_MEDAL_LABELS[medal as PubgMedal] ??
    medal
  );
}

export function basePriceFor(medal: string): number {
  if ((MEDALS as readonly string[]).includes(medal)) {
    return BASE_PRICE[medal as Medal];
  }
  if ((PUBG_MEDALS as readonly string[]).includes(medal)) {
    return PUBG_BASE_PRICE[medal as PubgMedal];
  }
  return 1000;
}

export function parseRoles(input: string): PlayerRole[] {
  const parts = input
    .toLowerCase()
    .split(/[\s,+/]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      if (p === "any" || p === "flex" || p === "all") return FLEX;
      if (p === "safe" || p === "carry" || p === "pos1" || p === "pos 1")
        return "safelane";
      if (p === "midlane" || p === "middle" || p === "pos2" || p === "pos 2")
        return "mid";
      if (p === "off" || p === "offlaner" || p === "pos3" || p === "pos 3")
        return "offlane";
      if (p === "soft" || p === "pos4" || p === "pos 4" || p === "4")
        return "soft_support";
      if (p === "hard" || p === "pos5" || p === "pos 5" || p === "5" || p === "support")
        return "hard_support";
      if (p === "sub" || p === "substitute" || p === "bench") return "sub";
      return p;
    });

  if (parts.includes(FLEX)) return [FLEX];

  const allowed = new Set<string>([...ROLES, FLEX]);
  const unique = [...new Set(parts)].filter((p): p is PlayerRole =>
    allowed.has(p),
  );
  return unique;
}

export function parseMedal(input: string): Medal | PubgMedal {
  const v = input.toLowerCase().trim().replace(/\s+/g, "_");
  if ((MEDALS as readonly string[]).includes(v)) return v as Medal;
  if ((PUBG_MEDALS as readonly string[]).includes(v)) return v as PubgMedal;
  throw new Error(
    `Unknown medal "${input}". Use: ${[...MEDALS, ...PUBG_MEDALS].join(", ")}`,
  );
}

export function parseMedalForGame(input: string, game: "DOTA"): Medal;
export function parseMedalForGame(input: string, game: "PUBG"): PubgMedal;
export function parseMedalForGame(
  input: string,
  game: string | null | undefined,
): Medal | PubgMedal;
export function parseMedalForGame(
  input: string,
  game: string | null | undefined,
) {
  const medal = parseMedal(input);
  const allowed = medalsForGame(game);
  if (!(allowed as readonly string[]).includes(medal)) {
    throw new Error(
      `That rank is not used for this cup. Use: ${allowed.join(", ")}`,
    );
  }
  return medal;
}

export function parseRole(input: string): Role {
  const parsed = parseRoles(input);
  const role = parsed.find((r): r is Role => r !== FLEX);
  if (!role) {
    throw new Error(
      `Unknown role "${input}". Use: ${ROLES.join(", ")}`,
    );
  }
  return role;
}

export function isAdminDiscordId(discordId: string): boolean {
  const raw = process.env.ADMIN_DISCORD_IDS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(discordId);
}

export function adminRoleName(): string {
  return process.env.ADMIN_ROLE_NAME?.trim() || "Admin";
}
