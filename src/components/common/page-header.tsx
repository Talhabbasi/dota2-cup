import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageHeaderPill = {
  label: ReactNode;
  value?: ReactNode;
};

export type PageHeaderProps = {
  title: string;
  /** Supporting copy under the title. */
  subtitle?: ReactNode;
  /** Small uppercase kicker above the title. */
  eyebrow?: ReactNode;
  /** Right-side actions (buttons, links). */
  actions?: ReactNode;
  /** Compact meta chips under the subtitle. */
  pills?: PageHeaderPill[];
  className?: string;
  children?: ReactNode;
};

/**
 * Unified list/detail page title block used across tournament routes.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  pills,
  className,
  children,
}: PageHeaderProps) {
  return (
    <header className={cn("teams-list-hero", className)}>
      <div className="team-hero-glow" aria-hidden />
      <div className="teams-list-hero-body">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h1>{title}</h1>
            {subtitle ? (
              typeof subtitle === "string" ? (
                <p className="lede">{subtitle}</p>
              ) : (
                <div className="lede">{subtitle}</div>
              )
            ) : null}
            {pills && pills.length > 0 ? (
              <div className="teams-list-hero-pills">
                {pills.map((pill, index) => (
                  <span key={index} className="teams-list-hero-pill">
                    {pill.value != null ? (
                      <>
                        <strong>{pill.value}</strong> {pill.label}
                      </>
                    ) : (
                      pill.label
                    )}
                  </span>
                ))}
              </div>
            ) : null}
            {children}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
