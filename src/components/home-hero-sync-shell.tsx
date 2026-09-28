"use client";

import type { ReactNode } from "react";
import { HeroSlideSyncProvider } from "@/components/hero-slide-sync";

/** Wraps background + content carousels so they share one timer. */
export function HomeHeroSyncShell({ children }: { children: ReactNode }) {
  return <HeroSlideSyncProvider>{children}</HeroSlideSyncProvider>;
}
