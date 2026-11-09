import { SEASON_PHASE } from "@/lib/season-constants";
import { cn } from "@/lib/utils";

type RoadStep = {
  key: string;
  label: string;
  hint: string;
};

const STEPS: RoadStep[] = [
  {
    key: "register",
    label: "Registration",
    hint: "Sign up and pay entry",
  },
  {
    key: "auction",
    label: "Auction",
    hint: "Captains draft the pool",
  },
  {
    key: "groups",
    label: "Group stage",
    hint: "Weekend fixtures",
  },
  {
    key: "playoffs",
    label: "Playoffs",
    hint: "Bracket to the final",
  },
  {
    key: "done",
    label: "Champions",
    hint: "Season complete",
  },
];

function activeIndex(phase: string | null | undefined): number {
  switch (phase) {
    case SEASON_PHASE.UPCOMING:
      return 0;
    case SEASON_PHASE.AUCTION_ACTIVE:
      return 1;
    case SEASON_PHASE.IN_PROGRESS:
      return 2;
    case SEASON_PHASE.COMPLETED:
      return 4;
    default:
      return 0;
  }
}

export function SeasonRoadmap({
  phase,
  seasonName,
  className,
}: {
  phase: string | null | undefined;
  seasonName?: string | null;
  className?: string;
}) {
  const now = activeIndex(phase);
  const title = seasonName?.trim() || "This season";

  return (
    <section
      className={cn("season-roadmap", className)}
      aria-label={`${title} roadmap`}
    >
      <div className="section-head row">
        <h2>Season path</h2>
        <p className="m-0 text-sm text-muted-foreground">{title}</p>
      </div>
      <ol className="season-roadmap-track">
        {STEPS.map((step, index) => {
          const done = index < now;
          const current = index === now;
          return (
            <li
              key={step.key}
              className={cn(
                "season-roadmap-step",
                done && "is-done",
                current && "is-now",
              )}
            >
              <span className="season-roadmap-index" aria-hidden>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="season-roadmap-status">
                {done ? "Done" : current ? "Now" : "Next"}
              </span>
              <strong className="season-roadmap-label">{step.label}</strong>
              <span className="season-roadmap-hint">{step.hint}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
