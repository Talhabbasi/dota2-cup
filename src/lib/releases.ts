export const UPDATE_KINDS = ["added", "fixed", "removed"] as const;
export type UpdateKind = (typeof UPDATE_KINDS)[number];

export type ReleaseNote = {
  id: string;
  title: string;
  added: string[];
  fixed: string[];
  removed: string[];
};

export const RELEASES: ReleaseNote[] = [
  {
    id: "2026-09-16-seasons",
    title: "Seasons, player history, #updates",
    added: [
      "Season 1 is live in the database. Old teams, players, fixtures, and payments were copied — nothing was wiped.",
      "Player pages show season team history and all-time heroes.",
      "Live table, matches, schedule, and playoffs stay on the current season.",
      "Admin-only #updates for release notes (Added / Fixed / Removed).",
      "`/season create` · `/season start` · `/updates add` in #admin.",
    ],
    fixed: [
      "Starting a future season will not mix old standings into the new cup.",
    ],
    removed: [
      "Wipe-the-database-to-start-a-new-cup. Use `/season create` then `/season start` instead.",
    ],
  },
];
