import { Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type TeamBadgeSide = "radiant" | "dire";

export type TeamBadgeProps = {
  name: string;
  logoUrl?: string | null;
  side?: TeamBadgeSide;
  /** Show the team name next to the shield. Default true. */
  showName?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function monogram(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const SIZE = {
  sm: { avatar: "size-7", text: "text-sm", mono: "text-[0.58rem]" },
  md: { avatar: "size-9", text: "text-sm", mono: "text-[0.68rem]" },
  lg: { avatar: "size-11", text: "text-base", mono: "text-[0.72rem]" },
} as const;

/**
 * Consistent team shield / avatar pill.
 */
export function TeamBadge({
  name,
  logoUrl,
  side,
  showName = true,
  size = "md",
  className,
}: TeamBadgeProps) {
  const dims = SIZE[size];
  const ring =
    side === "radiant"
      ? "ring-emerald-400/70 shadow-[0_0_12px_rgba(52,211,153,0.28)]"
      : side === "dire"
        ? "ring-red-500/70 shadow-[0_0_12px_rgba(239,68,68,0.28)]"
        : "ring-white/15";

  return (
    <span
      data-slot="team-badge"
      className={cn("inline-flex min-w-0 items-center gap-2.5", className)}
    >
      <Avatar
        className={cn(
          dims.avatar,
          "bg-[#0a0d14] ring-1 after:border-white/10",
          ring,
        )}
      >
        {logoUrl ? <AvatarImage src={logoUrl} alt="" /> : null}
        <AvatarFallback
          className={cn(
            "bg-transparent font-display font-bold tracking-[0.12em] text-foreground",
            dims.mono,
          )}
        >
          {monogram(name) || <Shield className="size-3.5 text-muted-foreground" aria-hidden />}
        </AvatarFallback>
      </Avatar>
      {showName ? (
        <span className={cn("truncate font-medium text-foreground", dims.text)}>
          {name}
        </span>
      ) : (
        <span className="sr-only">{name}</span>
      )}
    </span>
  );
}
