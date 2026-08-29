import {
  FLEX,
  MIN_ROSTER,
  ROLES,
  STARTING_ROLES,
  type PlayerRole,
  type Role,
} from "./constants";

export function isRosterSub(rosterRole: string | null): boolean {
  return rosterRole === "sub";
}

/** First 5 on a team are starters; players 6–7 are subs. */
export function rosterRoleForTeamJoin(currentSize: number): string | null {
  return currentSize >= MIN_ROSTER ? "sub" : null;
}

export function sortTeamRoster<T extends { isCaptain: boolean; createdAt: Date }>(
  players: T[],
): T[] {
  return [...players].sort((a, b) => {
    if (a.isCaptain !== b.isCaptain) return a.isCaptain ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export function parseRolesJson(json: string): PlayerRole[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed)) return parsed as PlayerRole[];
  } catch {
    /* ignore */
  }
  return [];
}

export function stringifyRoles(roles: PlayerRole[]): string {
  return JSON.stringify(roles);
}

export function deriveRosterRoleFromRegistration(rolesJson: string): Role | null {
  const roles = parseRolesJson(rolesJson);
  if (roles.includes(FLEX)) return null;
  const starting = roles.find((r): r is Role =>
    (STARTING_ROLES as readonly string[]).includes(r),
  );
  if (starting) return starting;
  if (roles.includes("sub")) return "sub";
  return null;
}

export function parseRegistrationRole(input: string): PlayerRole[] {
  const role = input.trim().toLowerCase();
  if (role === FLEX) return [FLEX];
  if ((ROLES as readonly string[]).includes(role)) {
    return [role as Role];
  }
  throw new Error(`Unknown role "${input}".`);
}

export function isEligibleForLot(roles: PlayerRole[], lotRole: Role): boolean {
  if (roles.includes(FLEX)) return true;
  if (lotRole === "sub") {
    return roles.includes("sub") || roles.includes(FLEX);
  }
  return roles.includes(lotRole);
}
