import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Shared admin surface tokens — use these everywhere in /admin. */
export const adminControlClass =
  "w-full rounded-lg border border-white/12 bg-[#0a0d14] px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-[#487fff]/55 focus:ring-1 focus:ring-[#487fff]/30";

export const adminCardClass =
  "rounded-xl border border-white/10 bg-[#121925] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.28)] sm:p-5";

export const adminCardAccentClass =
  "rounded-xl border border-[#487fff]/25 bg-[#121925] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.28)] sm:p-5";

export const adminCardDangerClass =
  "rounded-xl border border-rose-500/25 bg-[#121925] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.28)] sm:p-5";

export const adminBtnClass =
  "admin-btn inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-55";

export const adminBtnPrimaryClass =
  "admin-btn admin-btn-primary border border-amber-500/45 bg-gradient-to-b from-[#f0c56a] to-[#d4a13a] text-[#0a0d14] hover:brightness-105";

export const adminBtnSecondaryClass =
  "admin-btn admin-btn-secondary border border-white/14 bg-white/[0.04] text-foreground hover:border-[#487fff]/40 hover:bg-[#487fff]/10";

export const adminBtnGhostClass =
  "admin-btn admin-btn-ghost border border-transparent bg-transparent text-muted-foreground hover:border-white/12 hover:bg-white/[0.04] hover:text-foreground";

export const adminBtnDangerClass =
  "admin-btn admin-btn-danger border border-rose-500/35 bg-rose-500/10 text-rose-200 hover:border-rose-400/50 hover:bg-rose-500/20";

/** Expand/collapse headers like “Register player”. */
export const adminActionToggleClass =
  "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#487fff]/40";

/** Outer shell around disclosure actions. */
export const adminActionPanelClass = cn(
  adminCardClass,
  "transition hover:border-[#487fff]/35 hover:bg-[#161e2e]",
);

export function AdminCard({
  tone = "default",
  className,
  children,
}: {
  tone?: "default" | "accent" | "danger";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        tone === "accent" && adminCardAccentClass,
        tone === "danger" && adminCardDangerClass,
        tone === "default" && adminCardClass,
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AdminStatus({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "ok" | "warn" | "danger" | "gold";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold tracking-[0.08em] uppercase",
        tone === "ok" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        tone === "warn" &&
          "border-amber-500/35 bg-amber-500/10 text-amber-300",
        tone === "danger" &&
          "border-rose-500/35 bg-rose-500/10 text-rose-300",
        tone === "gold" &&
          "border-primary/40 bg-primary/10 text-primary",
        tone === "neutral" &&
          "border-white/12 bg-white/5 text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function AdminField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm", className)}>
      <span className="text-[0.68rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

export function AdminToolbar({
  title,
  count,
  hint,
  children,
}: {
  title: string;
  count?: number;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="m-0 text-base font-semibold text-foreground">
          {title}
          {typeof count === "number" ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {count}
            </span>
          ) : null}
        </h2>
        {hint ? (
          <p className="mt-1 mb-0 text-sm text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      {children ? (
        <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto sm:justify-end">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function AdminPanel({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <aside
      className={cn(
        adminCardClass,
        "flex h-full min-h-[280px] flex-col overflow-hidden p-0",
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-white/8 bg-gradient-to-r from-[#487fff]/12 to-transparent px-4 py-3">
        <div className="min-w-0">
          <p className="m-0 text-[0.65rem] font-semibold tracking-[0.16em] text-[#8eb4ff] uppercase">
            Selected
          </p>
          <h3 className="mt-1 mb-0 truncate text-lg font-semibold text-foreground">
            {title}
          </h3>
          {subtitle ? (
            <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
          ) : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className={cn(adminBtnClass, adminBtnGhostClass, "text-xs")}
          >
            Close
          </button>
        ) : null}
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">{children}</div>
      {footer ? (
        <footer className="border-t border-white/10 bg-[#0a0d14]/50 px-4 py-3">
          {footer}
        </footer>
      ) : null}
    </aside>
  );
}

export function AdminSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h4 className="m-0 text-[0.68rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {title}
      </h4>
      {children}
    </section>
  );
}

export function AdminEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-[#121925]/60 px-6 py-16 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function AdminBackLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <p className="mb-4 mt-0">
      <Link
        href={href}
        className="inline-flex cursor-pointer items-center text-sm text-muted-foreground transition hover:text-[#8eb4ff]"
      >
        ← {label}
      </Link>
    </p>
  );
}
