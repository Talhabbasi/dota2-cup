/**
 * Rebrand a copied cup from this file only.
 * Change these values, drop the logo in public/, and the site plus Discord bot follow.
 */
export const CUP_NAME = "MM Dota Cup";
/** Name of season 1 when the database is empty. Later seasons come from `/season`, not this file. */
export const SEASON_LABEL = "Season 1";

/** Short community name in eligibility copy ("played with MM"). */
export const COMMUNITY_NAME = "MM";

/** Discord application username shown in setup help. */
export const BOT_NAME = "dota2-cup";

export const CUP_DESCRIPTION = `${CUP_NAME} is an indoor Dota 2 tournament in Pakistan. Follow teams, weekend schedules, playoffs, auction results, predictions, and match scores.`;

export const CUP_TITLE_SUFFIX = "Indoor Dota 2 Tournament in Pakistan";

export const CUP_TAGLINE =
  "Indoor Dota 2 cup in Pakistan. Captains, brackets, and kickoffs in one place.";

export const PUBG_CUP_NAME = "MM PUBG Cup";

export const PUBG_CUP_TAGLINE =
  "Indoor PUBG cup. Solo, duo, or squad. Placement points plus 1 point per kill.";

export type CupBrand = ReturnType<typeof cupBrand>;

export function cupBrand(game: "DOTA" | "PUBG") {
  if (game === "PUBG") {
    return {
      game,
      gameLabel: "PUBG",
      name: PUBG_CUP_NAME,
      titleSuffix: "Indoor PUBG Tournament in Pakistan",
      description: `${PUBG_CUP_NAME} is an indoor PUBG tournament in Pakistan. Follow squads, lobby schedules, auction results, and the points table.`,
    };
  }
  return {
    game,
    gameLabel: "Dota 2",
    name: CUP_NAME,
    titleSuffix: CUP_TITLE_SUFFIX,
    description: CUP_DESCRIPTION,
  };
}

/** Generic kicker — never hardcode franchise count (that comes from Season.teamCount). */
export const CUP_KICKER = `Indoor ${COMMUNITY_NAME} · Pakistan`;

export function cupKicker(teamCount?: number | null) {
  if (teamCount && teamCount > 0) {
    return `${CUP_KICKER} · ${teamCount} teams`;
  }
  return CUP_KICKER;
}

export const CUP_COMMUNITY_LINE = `${COMMUNITY_NAME} community only`;

/** Filename inside /public. */
export const CUP_ICON_FILE = "mm-dota-cup-icon.png";
export const CUP_ICON_PATH = `/${CUP_ICON_FILE}`;

/** Used only when NEXTAUTH_URL is unset. */
export const CUP_SITE_FALLBACK = "https://dota2-cup.vercel.app";

export function cupPublicUrl(): string {
  return (process.env.NEXTAUTH_URL || CUP_SITE_FALLBACK).replace(/\/+$/, "");
}

/** Split "MM Dota Cup" into the two hero lines: ["MM Dota", "Cup"]. */
export function cupNameLines(): [string, string] {
  const words = CUP_NAME.trim().split(/\s+/);
  if (words.length < 2) return [CUP_NAME, ""];
  const tail = words.pop() ?? "";
  return [words.join(" "), tail];
}
