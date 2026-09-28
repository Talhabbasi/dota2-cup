"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SEASON_VIEW_COOKIE } from "@/lib/season-view-cookie";
import type { PublicSeasonRow } from "@/lib/seasons";

function phaseLabel(row: PublicSeasonRow) {
  if (row.isActive) return "Live";
  if (row.phase === "COMPLETED" || row.status === "archived") return "Complete";
  if (row.phase === "AUCTION_ACTIVE") return "Auction";
  if (row.phase === "UPCOMING") return "Upcoming";
  return row.phase;
}

function readSeasonCookie() {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${SEASON_VIEW_COOKIE}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : "";
}

export function SeasonSwitcher({
  seasons,
  viewSeasonNumber = null,
}: {
  seasons: PublicSeasonRow[];
  currentSeasonId?: string | null;
  viewSeasonNumber?: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const liveNumber = seasons.find((s) => s.isActive)?.number ?? null;
  const newestNumber = seasons[0]?.number ?? null; // listPublicSeasons is desc by number? check

  const fromQuery = searchParams.get("season")?.trim() || "";
  const fromCookie = readSeasonCookie();
  const fromServer =
    viewSeasonNumber != null ? String(viewSeasonNumber) : "";

  const picked = fromQuery || fromCookie || fromServer;
  const matched = seasons.find(
    (s) => String(s.number) === picked || s.id === picked,
  );

  const fallbackNumber =
    liveNumber ??
    newestNumber ??
    seasons[seasons.length - 1]?.number ??
    null;

  const selected = matched
    ? String(matched.number)
    : fallbackNumber != null
      ? String(fallbackNumber)
      : "";

  if (seasons.length === 0) return null;
  // Still show with one season so the label is clear.
  if (!selected) return null;

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("season", value);
    document.cookie = `${SEASON_VIEW_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 180}; SameSite=Lax`;
    const q = params.toString();
    router.push(q ? `${pathname}?${q}` : pathname);
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="hidden text-muted-foreground sm:inline">Season</span>
      <select
        className="max-w-[11rem] rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-xs text-foreground"
        value={selected}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Choose season"
      >
        {seasons.map((row) => (
          <option key={row.id} value={String(row.number)}>
            Season {row.number} ({phaseLabel(row)})
          </option>
        ))}
      </select>
    </label>
  );
}
