import {
  FLEX,
  MIN_ROSTER,
  ROLE_LABELS,
  ROLES,
  STARTING_ROLES,
  parseRoles,
  type PlayerRole,
  type Role,
  type StartingRole,
} from "./constants";

export function isRosterSub(rosterRole: string | null): boolean {
  return rosterRole === "sub";
}

/** First 5 starters on a team; anyone joining after that is a sub. */
export function rosterRoleForTeamJoin(starterCount: number): string | null {
  return starterCount >= MIN_ROSTER ? "sub" : null;
}

export function starterCountOnTeam(
  players: { rosterRole: string | null }[],
): number {
  return players.filter((player) => !isRosterSub(player.rosterRole)).length;
}

function joinTime(player: {
  createdAt: Date;
  teamJoinedAt?: Date | null;
}): number {
  return (player.teamJoinedAt ?? player.createdAt).getTime();
}

export function sortTeamRoster<
  T extends { isCaptain: boolean; createdAt: Date; teamJoinedAt?: Date | null },
>(players: T[]): T[] {
  return [...players].sort((a, b) => {
    if (a.isCaptain !== b.isCaptain) return a.isCaptain ? -1 : 1;
    const joined = joinTime(a) - joinTime(b);
    if (joined !== 0) return joined;
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

/** Registration roles: one or more of safelane/mid/offlane/supports. No flex. */
export function parseRegistrationRoles(
  input: string | string[] | null | undefined,
): StartingRole[] {
  const raw = Array.isArray(input)
    ? input.join(",")
    : typeof input === "string"
      ? input
      : "";
  const starting = [
    ...new Set(
      parseRoles(raw).filter((r): r is StartingRole =>
        (STARTING_ROLES as readonly string[]).includes(r),
      ),
    ),
  ];
  if (starting.length === 0) {
    throw new Error(
      `Pick at least one role: ${STARTING_ROLES.map((r) => ROLE_LABELS[r]).join(", ")}.`,
    );
  }
  return starting;
}

/** @deprecated Prefer parseRegistrationRoles — kept for single-string call sites. */
export function parseRegistrationRole(input: string): PlayerRole[] {
  return parseRegistrationRoles(input);
}

export function isEligibleForLot(roles: PlayerRole[], lotRole: Role): boolean {
  if (roles.includes(FLEX)) return true;
  if (lotRole === "sub") {
    return roles.includes("sub") || roles.includes(FLEX);
  }
  return roles.includes(lotRole);
}
