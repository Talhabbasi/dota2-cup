import Link from "next/link";
import { getUpcomingFixture } from "@/lib/data";
import { formatScheduleWhen } from "@/lib/schedule";

/**
 * Top strip — next real fixture, or hidden when nothing is booked.
 */
export async function ClosedBanner() {
  const upcoming = await getUpcomingFixture();
  if (!upcoming?.scheduledAt) return null;

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
