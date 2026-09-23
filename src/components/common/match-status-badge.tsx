import { CheckCircle2, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type MatchStatus = "live" | "upcoming" | "completed";

export type MatchStatusBadgeProps = {
  status: MatchStatus;
  /** Optional override for the badge text. */
  label?: string;
  className?: string;
};

const COPY: Record<MatchStatus, string> = {
  live: "LIVE",
  upcoming: "UPCOMING",
  completed: "FT",
};

/**
 * Uniform match status chip: LIVE (pulse), UPCOMING (amber), COMPLETED (slate).
 */
export function MatchStatusBadge({
  status,
  label,
  className,
}: MatchStatusBadgeProps) {
  const text = label ?? COPY[status];

  return (
    <span
      data-slot="match-status-badge"
      data-status={status}
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-[0.62rem] font-semibold tracking-[0.12em] uppercase",
        status === "live" && "border-red-500/40 bg-red-500/15 text-red-300",
        status === "upcoming" &&
          "border-amber-500/40 bg-amber-500/10 text-amber-400",
        status === "completed" &&
          "border-white/15 bg-transparent text-slate-400",
        className,
      )}
    >
      {status === "live" ? (
        <span
          className="size-1.5 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.95)]"
          aria-hidden
        />
      ) : status === "upcoming" ? (
        <Clock3 className="size-3" aria-hidden />
      ) : (
        <CheckCircle2 className="size-3" aria-hidden />
      )}
      {text}
    </span>
  );
}
