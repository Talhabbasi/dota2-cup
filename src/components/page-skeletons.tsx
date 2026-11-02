import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <span className={cn("skel", className)} />;
}

function SkelFrame({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className} role="status" aria-live="polite" aria-busy="true">
      <p className="sr-only">{label}</p>
      <div aria-hidden>{children}</div>
    </div>
  );
}

function SkelHeader({
  titleClass = "h-10 w-56 max-w-full",
  pills = 3,
  lines = 1,
}: {
  titleClass?: string;
  pills?: number;
  lines?: number;
}) {
  return (
    <header className="teams-list-hero">
      <div className="team-hero-glow" />
      <div className="teams-list-hero-body">
        <Bone className="mb-3 h-3 w-24" />
        <Bone className={titleClass} />
        {Array.from({ length: lines }, (_, index) => (
          <Bone
            key={index}
            className={cn(
              "mt-3 h-4",
              index === 0 ? "w-full max-w-xl" : "w-4/5 max-w-md",
            )}
          />
        ))}
        {pills > 0 ? (
          <div className="teams-list-hero-pills mt-4">
            {Array.from({ length: pills }, (_, index) => (
              <Bone key={index} className="h-8 w-28 rounded-full" />
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}

function SkelPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("skel-panel", className)}>{children}</div>;
}

function SkelRows({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }, (_, index) => (
        <Bone key={index} className="h-12 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <SkelFrame label="Loading home">
      <section className="hero-stage">
        <div className="hero-stage-inner">
          <Bone className="h-3 w-36" />
          <Bone className="mt-4 h-14 w-72 max-w-full" />
          <Bone className="mt-3 h-4 w-full max-w-lg" />
          <div className="mt-5 flex gap-3">
            <Bone className="h-11 w-32 rounded-full" />
            <Bone className="h-11 w-32 rounded-full" />
          </div>
        </div>
      </section>
      <div className="page home-body">
        <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <SkelPanel key={index}>
              <Bone className="h-5 w-10" />
              <Bone className="mt-3 h-5 w-32" />
              <Bone className="mt-3 h-3 w-full" />
              <Bone className="mt-2 h-3 w-4/5" />
            </SkelPanel>
          ))}
        </div>
        <SkelPanel>
          <Bone className="mb-4 h-5 w-36" />
          <SkelRows count={4} />
        </SkelPanel>
      </div>
    </SkelFrame>
  );
}

export function ScheduleSkeleton() {
  return (
    <SkelFrame label="Loading schedule" className="page schedule-page">
      <SkelHeader titleClass="h-10 w-72 max-w-full" lines={1} pills={3} />
      <div className="group-standings-row-wrap">
        {Array.from({ length: 2 }, (_, index) => (
          <SkelPanel key={index}>
            <Bone className="mb-4 h-5 w-24" />
            <SkelRows count={4} />
          </SkelPanel>
        ))}
      </div>
      <SkelPanel>
        <Bone className="mb-4 h-5 w-40" />
        <SkelRows count={4} />
      </SkelPanel>
    </SkelFrame>
  );
}

export function PredictionsSkeleton() {
  return (
    <SkelFrame label="Loading predictions" className="page pred-page">
      <SkelHeader titleClass="h-10 w-64 max-w-full" lines={2} pills={4} />
      <SkelPanel className="mb-6">
        <Bone className="mb-4 h-3 w-28" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Bone key={index} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </SkelPanel>
      <SkelPanel>
        <Bone className="mb-4 h-5 w-40" />
        <SkelRows count={4} />
      </SkelPanel>
    </SkelFrame>
  );
}

export function PlayoffsSkeleton() {
  return (
    <SkelFrame label="Loading playoffs" className="page playoffs-page">
      <SkelHeader titleClass="h-10 w-72 max-w-full" lines={2} pills={2} />
      <div className="group-standings-row-wrap">
        {Array.from({ length: 2 }, (_, index) => (
          <SkelPanel key={index}>
            <Bone className="mb-4 h-5 w-24" />
            <SkelRows count={4} />
          </SkelPanel>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, column) => (
          <SkelPanel key={column}>
            <Bone className="mb-4 h-4 w-28" />
            <SkelRows count={2} />
          </SkelPanel>
        ))}
      </div>
    </SkelFrame>
  );
}

export function PlayersSkeleton() {
  return (
    <SkelFrame label="Loading players" className="page players-list-page">
      <SkelHeader
        titleClass="h-10 w-40 max-w-full"
        lines={0}
        pills={3}
      />
      <ul className="mb-6 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <li key={index}>
            <Bone className="h-[4.6rem] w-full rounded-xl" />
          </li>
        ))}
      </ul>
      <SkelPanel>
        <Bone className="mb-4 h-11 w-full max-w-lg rounded-xl" />
        <SkelRows count={6} />
      </SkelPanel>
    </SkelFrame>
  );
}
