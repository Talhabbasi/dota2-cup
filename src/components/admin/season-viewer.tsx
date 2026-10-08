"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { adminControlClass } from "@/components/admin/ui";
import type { AdminSeasonOption } from "@/lib/admin-season-view";
import { ADMIN_SEASON_COOKIE } from "@/lib/season-view-cookie";
import { cn } from "@/lib/utils";

function rememberSeason(id: string) {
  document.cookie = `${ADMIN_SEASON_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=2592000; samesite=lax`;
}

function seasonOptionLabel(season: AdminSeasonOption) {
  const game = season.game === "PUBG" ? "PUBG" : "Dota";
  const name =
    season.name !== `Season ${season.number}` ? ` · ${season.name}` : "";
  const state = season.isLive ? " (live)" : season.isArchive ? " (archive)" : "";
  return `${game} · Season ${season.number}${name}${state}`;
}

/** Mirrors resolveAdminSeasonView so the picker shows the season the page loaded. */
function pickSeason(
  options: AdminSeasonOption[],
  raw: string | null,
): AdminSeasonOption | null {
  const fallback = options.find((o) => o.isLive) ?? options[0] ?? null;
  const value = raw?.trim();
  if (!value) return fallback;
  const byId = options.find((o) => o.id === value);
  if (byId) return byId;
  const asNum = Number(value);
  const numbered = Number.isFinite(asNum)
    ? options.filter((o) => o.number === asNum)
    : [];
  return numbered.length === 1 ? numbered[0]! : fallback;
}

export function AdminSeasonPicker({
  options,
  savedSeasonId,
}: {
  options: AdminSeasonOption[];
  savedSeasonId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const param = useSearchParams().get("season");
  const view = pickSeason(options, param || savedSeasonId);
  const liveId = options.find((o) => o.isLive)?.id ?? null;

  useEffect(() => {
    if (view) rememberSeason(view.id);
  }, [view]);

  if (!view) return null;
  const readOnly = !view.isLive;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <label className="sr-only" htmlFor="admin-season-picker">
        Viewing season
      </label>
      <select
        id="admin-season-picker"
        className={cn(
          adminControlClass,
          "h-9 w-auto max-w-[11rem] py-1 text-sm sm:max-w-[18rem]",
          readOnly && "border-amber-500/40",
        )}
        value={view.id}
        onChange={(e) => {
          const next = options.find((o) => o.id === e.target.value);
          if (!next) return;
          rememberSeason(next.id);
          router.push(`${pathname}?season=${next.id}`);
        }}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {seasonOptionLabel(o)}
          </option>
        ))}
      </select>
      {readOnly ? (
        <>
          <span
            className="hidden shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-amber-200 md:inline"
            title="Archive view — read-only. Live season writes stay on the active cup."
          >
            Read-only
          </span>
          {liveId ? (
            <Link
              href={`${pathname}?season=${liveId}`}
              className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/20"
            >
              Back to live
            </Link>
          ) : null}
        </>
      ) : (
        <span className="hidden shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-200 md:inline">
          Live
        </span>
      )}
    </div>
  );
}
