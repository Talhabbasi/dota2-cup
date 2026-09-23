"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { Suspense } from "react";

function PlayoffGraphSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={compact ? "mt-6" : "mb-6"}
      aria-busy="true"
      aria-label="Loading playoff graph"
    >
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <div className="h-6 w-36 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-52 animate-pulse rounded bg-white/5" />
      </div>
      <div
        className={
          compact
            ? "h-[280px] w-full animate-pulse rounded-xl border border-white/10 bg-[#121824]"
            : "h-[min(70vh,520px)] w-full animate-pulse rounded-xl border border-white/10 bg-[#121824]"
        }
      />
    </section>
  );
}

const PlayoffGraphClient = dynamic(
  () =>
    import("@/components/playoff-graph").then((mod) => ({
      default: mod.PlayoffGraph,
    })),
  { ssr: false },
);

type PlayoffGraphProps = ComponentProps<
  typeof import("@/components/playoff-graph").PlayoffGraph
>;

export function PlayoffGraphLazy(props: PlayoffGraphProps) {
  return (
    <Suspense fallback={<PlayoffGraphSkeleton compact={props.compact} />}>
      <PlayoffGraphClient {...props} />
    </Suspense>
  );
}
