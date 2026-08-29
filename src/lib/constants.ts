export const STARTING_PURSE = 20_000;
export const MAX_CAPTAINS = 8;
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

export function basePriceFor(medal: string): number {
  return BASE_PRICE[(medal as Medal) ?? "uncalibrated"] ?? 1000;
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

export function parseMedal(input: string): Medal {
  const v = input.toLowerCase().trim();
  if ((MEDALS as readonly string[]).includes(v)) return v as Medal;
  throw new Error(
    `Unknown medal "${input}". Use: ${MEDALS.join(", ")}`,
  );
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
