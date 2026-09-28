/**
 * Public marketing / explainer copy driven by Admin → Seasons (+ schedule defaults).
 * Keeps hero, home format cards, Schedule, and Playoffs in sync with team count / format.
 */

import {
  FINAL_BEST_OF,
  REGULAR_BEST_OF,
  SEASON_PHASE,
  formatSeasonStartDate,
  seasonPlanLine,
  tournamentFormatLabel,
} from "./season-constants";

export type SeasonCopyInput = {
  number: number;
  name?: string | null;
  teamCount: number;
  tournamentFormat?: string | null;
  plannedStartAt?: Date | string | null;
  startedAt?: Date | string | null;
  phase?: string | null;
};

/** Two equal groups from admin team count (8 → 4, 10 → 5, 12 → 6). */
export function seasonGroupSize(teamCount: number) {
  const n = Number.isFinite(teamCount) && teamCount > 0 ? teamCount : 8;
  return Math.max(2, Math.floor(n / 2));
}

export function seasonTeamsLabel(teamCount: number) {
  const n = Number.isFinite(teamCount) && teamCount > 0 ? teamCount : 8;
  return `${n} team${n === 1 ? "" : "s"}`;
}

export function seriesFormatSummary() {
  return `Grand Final Bo${FINAL_BEST_OF}; other series Bo${REGULAR_BEST_OF}`;
}

export type SeasonFormatCard = {
  index: string;
  title: string;
  copy: string;
};

export function seasonFormatCards(teamCount: number): SeasonFormatCard[] {
  const perGroup = seasonGroupSize(teamCount);
  const teams = seasonTeamsLabel(teamCount);
  const hasPlayIn = perGroup >= 5;
  return [
    {
      index: "01",
      title: "Group stage",
      copy: `Two groups of ${perGroup} (${teams}). Round-robin Bo${REGULAR_BEST_OF}. Last place in each group is out.`,
    },
    {
      index: "02",
      title: "Crossovers",
      copy: hasPlayIn
        ? "A1 vs B2 and B1 vs A2 (upper). A3 vs B4 and B3 vs A4 play into lower vs upper losers."
        : "A1 vs B2 and B1 vs A2. Each 3rd waits for a crossover loser.",
    },
    {
      index: "03",
      title: "Playoffs",
      copy: `Double-elim graph. ${seriesFormatSummary()}.`,
    },
  ];
}

export function seasonHeroTagline(input: SeasonCopyInput) {
  const plan = seasonPlanLine(input);
  if (
    input.phase === SEASON_PHASE.UPCOMING ||
    input.phase === SEASON_PHASE.AUCTION_ACTIVE
  ) {
    return plan;
  }
  const perGroup = seasonGroupSize(input.teamCount);
  return `${seasonTeamsLabel(input.teamCount)} · two groups of ${perGroup} · one bracket`;
}

export function seasonHeroLead(
  input: SeasonCopyInput,
  opts?: { preTournament?: boolean },
) {
  const format = tournamentFormatLabel(input.tournamentFormat);
  const start =
    formatSeasonStartDate(input.plannedStartAt) ??
    formatSeasonStartDate(input.startedAt);
  const name = input.name?.trim() || `Season ${input.number}`;
  const teams = seasonTeamsLabel(input.teamCount);

  if (opts?.preTournament) {
    return `${name} · ${format} · ${teams}${
      start ? ` · starts ${start}` : ""
    }. Register on the site or in Discord — pool stays in sync with admin.`;
  }

  const perGroup = seasonGroupSize(input.teamCount);
  return `${name}: ${teams} in two groups of ${perGroup}, then a live playoff graph. ${seriesFormatSummary()}. Weekend kickoffs in PKT.`;
}

export function seasonScheduleSubtitle(input: SeasonCopyInput) {
  const perGroup = seasonGroupSize(input.teamCount);
  const teams = seasonTeamsLabel(input.teamCount);
  return `Season ${input.number}: ${teams} · Group A Saturday, Group B Sunday (${perGroup} per group). Group nights and weekend playoffs in PKT — times follow booked fixtures in admin.`;
}

export function seasonPlayoffsSubtitle(input: SeasonCopyInput) {
  const perGroup = seasonGroupSize(input.teamCount);
  const teams = seasonTeamsLabel(input.teamCount);
  const hasPlayIn = perGroup >= 5;
  const afterGroups = hasPlayIn
    ? `last place is eliminated; top 4 advance — 1st/2nd to upper, A3 vs B4 and B3 vs A4 play into lower vs Upper Round 1 losers`
    : `last place is eliminated; 3rd in each group waits for a crossover loser — A3 vs loser of A1 vs B2, B3 vs loser of B1 vs A2`;
  return `After groups (${teams}, ${perGroup} per side): ${afterGroups} — then double-elimination. ${seriesFormatSummary()}.`;
}

export function seasonWeekendBlurb(kind: "group" | "playoff" | "final") {
  if (kind === "final") {
    return `Upper Final winner vs Lower Final winner. Bo${FINAL_BEST_OF}, first to ${Math.ceil(FINAL_BEST_OF / 2)}.`;
  }
  if (kind === "playoff") {
    return "Saturday and Sunday only. Playoff kickoffs follow the admin schedule (PKT).";
  }
  return "Saturday and Sunday only. Group kickoffs follow the admin schedule (PKT).";
}

export function seasonEmptyTeamsCopy(input: SeasonCopyInput) {
  const start = formatSeasonStartDate(input.plannedStartAt);
  return `No franchises yet for Season ${input.number}. Admin planned ${seasonTeamsLabel(input.teamCount)}${
    start ? ` · starts ${start}` : ""
  }.`;
}
