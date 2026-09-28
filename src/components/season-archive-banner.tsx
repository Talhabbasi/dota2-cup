import Link from "next/link";
import type { ResolvedViewSeason } from "@/lib/season-view";

export function SeasonArchiveBanner({
  view,
}: {
  view: ResolvedViewSeason | null;
}) {
  if (!view?.isArchive) return null;
  return (
    <div
      className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-center text-sm text-amber-100/95"
      role="status"
    >
      Archive view — Season {view.number}
      {view.championName ? ` · ${view.championName} won` : ""}.{" "}
      <Link href="/" className="underline underline-offset-2">
        Back to current site
      </Link>
    </div>
  );
}
