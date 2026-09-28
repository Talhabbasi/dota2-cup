"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** Shared hold between background photos and season content slides. */
export const HERO_SLIDE_HOLD_MS = 7000;
/** Match `.hero-slide` fade so content and background crossfade together. */
export const HERO_SLIDE_FADE_MS = 1450;

type HeroSlideSyncValue = {
  step: number;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  /** Jump both carousels to a shared step. */
  goToStep: (step: number) => void;
  /** Advance one tick (same as the auto timer). */
  bump: () => void;
};

const HeroSlideSyncContext = createContext<HeroSlideSyncValue | null>(null);

export function HeroSlideSyncProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  const goToStep = useCallback((next: number) => {
    setStep(Math.max(0, next));
  }, []);

  const bump = useCallback(() => {
    setStep((current) => current + 1);
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches || paused) return;
    const id = window.setInterval(() => {
      setStep((current) => current + 1);
    }, HERO_SLIDE_HOLD_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const value = useMemo(
    () => ({ step, paused, setPaused, goToStep, bump }),
    [step, paused, goToStep, bump],
  );

  return (
    <HeroSlideSyncContext.Provider value={value}>
      {children}
    </HeroSlideSyncContext.Provider>
  );
}

export function useHeroSlideSync() {
  const ctx = useContext(HeroSlideSyncContext);
  if (!ctx) {
    throw new Error("useHeroSlideSync must be used inside HeroSlideSyncProvider");
  }
  return ctx;
}

/** Optional hook when the provider might be absent (tests). */
export function useHeroSlideSyncOptional() {
  return useContext(HeroSlideSyncContext);
}
