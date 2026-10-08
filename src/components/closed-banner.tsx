import Link from "next/link";
import { getUpcomingFixture } from "@/lib/data";
import { formatScheduleWhen } from "@/lib/schedule";
import { getLiveSeason, listPublicSeasons } from "@/lib/seasons";
import { isPubgSeason } from "@/lib/games";
import {
  SEASON_STATUS,
  seasonPlanLine,
} from "@/lib/season-constants";

/**
 * Top strip — next real fixture, else live/upcoming season plan from admin.
 */
export async function ClosedBanner() {
  const upcoming = await getUpcomingFixture();
  if (upcoming?.scheduledAt) {
    const when = formatScheduleWhen(upcoming.scheduledAt);
    const playoff =
      upcoming.kind === "playoff" ||
      upcoming.kind === "final" ||
      Boolean(upcoming.slotKey);
    const label = playoff ? "Playoffs" : "Next match";
    const teams = `${upcoming.radiantTeam.name} vs ${upcoming.direTeam.name}`;

    return (
      <div className="relative z-30 border-b border-white/10 bg-[#0a0d14] pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-center px-4 py-1.5">
          <p className="m-0 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-display text-[0.72rem] font-semibold tracking-[0.14em] text-foreground uppercase">
            <span className="inline-flex items-center gap-1.5 text-red-400">
              <span
                className="size-1.5 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.95)]"
                aria-hidden
              />
              {label}
            </span>
            <span className="text-white/25" aria-hidden>
              ·
            </span>
            <span className="tracking-normal text-muted-foreground normal-case">
              {teams}
            </span>
            <span className="text-white/25" aria-hidden>
              ·
            </span>
            <span className="tracking-normal text-muted-foreground normal-case">
              {when}
            </span>
            <Link
              href="/schedule"
              className="tracking-normal text-primary/90 normal-case underline-offset-2 hover:underline"
            >
              Schedule
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const [live, seasons] = await Promise.all([
    getLiveSeason(),
    listPublicSeasons(),
  ]);
  const plan =
    live ??
    seasons.find(
      (row) =>
        row.status === SEASON_STATUS.upcoming ||
        row.phase === "UPCOMING" ||
        row.phase === "AUCTION_ACTIVE",
    ) ??
    null;
  if (!plan) return null;

  const line = seasonPlanLine({
    number: plan.number,
    teamCount: plan.teamCount,
    plannedStartAt: plan.plannedStartAt,
    startedAt: plan.startedAt,
    phase: plan.phase,
  });

  return (
    <div className="relative z-30 border-b border-white/10 bg-[#0a0d14] pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-center px-4 py-1.5">
        <p className="m-0 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-display text-[0.72rem] font-semibold tracking-[0.14em] text-foreground uppercase">
          <span className="inline-flex items-center gap-1.5 text-amber-400">
            <span
              className="size-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.85)]"
              aria-hidden
            />
            {isPubgSeason(plan) ? "PUBG" : "Dota"}
          </span>
          <span className="text-white/25" aria-hidden>
            ·
          </span>
          <span className="tracking-normal text-muted-foreground normal-case">
            {line}
          </span>
          <Link
            href="/register"
            className="tracking-normal text-primary/90 normal-case underline-offset-2 hover:underline"
          >
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
