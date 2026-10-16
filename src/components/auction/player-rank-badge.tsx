import { medalDisplay } from "@/lib/auction-ui";
import { cn } from "@/lib/utils";

export function PlayerRankBadge({
  medal,
  medalLabel,
  className,
}: {
  medal: string | null | undefined;
  medalLabel?: string | null;
  className?: string;
}) {
  const label = medalDisplay(medal, medalLabel);
  if (!medal && !medalLabel) return null;
  return (
    <span
      className={cn(
        "team-medal-pill inline-flex items-center",
        className,
      )}
    >
      {label}
    </span>
  );
}
