import { prisma } from "./prisma";

type ScheduleDelegate = {
  findFirst: (...args: unknown[]) => Promise<unknown>;
};

export function hasScheduleTable(): boolean {
  const delegate = (prisma as { scheduledFixture?: ScheduleDelegate }).scheduledFixture;
  return typeof delegate?.findFirst === "function";
}

/** Website reads: never throw if schedule table/client is not ready yet. */
export async function safeScheduleQuery<T>(
  fallback: T,
  query: () => Promise<T>,
): Promise<T> {
  if (!hasScheduleTable()) return fallback;
  try {
    return await query();
  } catch {
    return fallback;
  }
}
