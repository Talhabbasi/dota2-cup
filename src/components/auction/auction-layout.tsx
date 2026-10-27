import { cn } from "@/lib/utils";

/**
 * AuctionBazi-inspired responsive shell:
 * desktop 3-col · tablet 2-col · mobile stacked (center first).
 */
export function AuctionLayout({
  left,
  center,
  right,
  className,
}: {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        "grid-cols-1",
        "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]",
        "xl:grid-cols-[minmax(240px,0.85fr)_minmax(0,1.35fr)_minmax(240px,0.85fr)]",
        className,
      )}
    >
      <div className="order-1 min-w-0 xl:order-2">{center}</div>
      <div className="order-2 min-w-0 space-y-4 xl:order-1">{left}</div>
      <div className="order-3 min-w-0 space-y-4 lg:col-span-2 xl:col-span-1 xl:order-3">
        {right}
      </div>
    </div>
  );
}

export function AuctionHeader({
  title,
  subtitle,
  connected,
  problem,
  actions,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  connected?: boolean;
  problem?: string | null;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="m-0 font-display text-xl tracking-wide uppercase sm:text-2xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 mb-0 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {typeof connected === "boolean" ? (
          <p
            role="status"
            className={cn(
              "m-0 inline-flex items-center gap-2 text-sm",
              connected ? "text-emerald-300" : "text-amber-300",
            )}
          >
            <span
              className={cn(
                "size-2 rounded-full",
                connected ? "bg-emerald-400 animate-pulse" : "bg-amber-400",
              )}
              aria-hidden
            />
            {connected
              ? "Live connected"
              : problem
                ? `Reconnecting — ${problem}`
                : "Reconnecting…"}
          </p>
        ) : null}
        {actions}
      </div>
    </div>
  );
}
