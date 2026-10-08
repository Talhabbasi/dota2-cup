"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  adminCardClass,
  adminControlClass,
} from "@/components/admin/ui";
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

export function AdminSeasonViewer({
  view,
  options,
  readOnly,
  publicSeasonParam: _publicSeasonParam,
  publicHref,
}: {
  view: AdminSeasonOption;
  options: AdminSeasonOption[];
  readOnly: boolean;
  publicSeasonParam: string;
  /** Public page to open for full archive detail, e.g. /matches */
  publicHref: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const publicUrl = readOnly ? "/seasons" : publicHref;
  useEffect(() => {
    rememberSeason(view.id);
  }, [view.id]);

  return (
    <div
      className={cn(
        adminCardClass,
        "mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        readOnly && "border-amber-500/30 bg-amber-500/5",
      )}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <label className="block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Viewing season
        </label>
        <select
          className={cn(adminControlClass, "max-w-md")}
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
        <p className="m-0 text-sm text-muted-foreground">
          {readOnly
            ? "Archive view — read-only. Live Season writes (register, auction, new matches) stay on the active cup."
            : "Live season — edits apply here."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={publicUrl}
          className="rounded-lg border border-white/14 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-foreground transition hover:border-[#487fff]/40 hover:bg-[#487fff]/10"
        >
            {readOnly
              ? "Season archive"
              : `Open public ${view.game === "PUBG" ? "PUBG" : "Dota"} Season ${view.number}`}
        </Link>
        {readOnly ? (
          <Link
            href={`${pathname}?season=${options.find((o) => o.isLive)?.id ?? view.id}`}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20"
          >
            Back to live
          </Link>
        ) : null}
      </div>
    </div>
  );
}
