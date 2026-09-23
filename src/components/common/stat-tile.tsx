import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTileProps = {
  label: ReactNode;
  value: ReactNode;
  /** Optional icon shown above the value. */
  icon?: ReactNode;
  className?: string;
};

/**
 * Glassmorphic metric tile — tabular mono numbers for counts & player/hero stats.
 */
export function StatTile({ label, value, icon, className }: StatTileProps) {
  return (
    <div
      data-slot="stat-tile"
      className={cn(
        "rounded-xl border border-white/10 bg-[#121824]/60 px-4 py-3 backdrop-blur-sm",
        className,
      )}
    >
      {icon ? (
        <div className="mb-2 text-primary [&_svg]:size-4">{icon}</div>
      ) : null}
      <b className="block font-mono text-xl font-bold leading-none tabular-nums text-primary">
        {value}
      </b>
      <span className="mt-1.5 block text-[0.68rem] tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}
