import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export type EsportsCardProps = ComponentProps<"div"> & {
  /** Soft lift on hover — default on for interactive surfaces. */
  interactive?: boolean;
  /** Elevated modal/drawer surface (#1a2232). */
  elevated?: boolean;
};

/**
 * Standard tournament surface: #121824 + border-white/10.
 */
export function EsportsCard({
  className,
  interactive = true,
  elevated = false,
  ...props
}: EsportsCardProps) {
  return (
    <div
      data-slot="esports-card"
      className={cn(
        "rounded-xl border border-white/10 text-foreground shadow-[0_12px_40px_rgba(0,0,0,0.28)]",
        elevated ? "bg-surface-elevated" : "bg-[#121824]",
        interactive &&
          "transition-all duration-200 hover:border-amber-500/30 hover:bg-[#161f30]",
        className,
      )}
      {...props}
    />
  );
}
