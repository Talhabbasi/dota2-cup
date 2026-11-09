import Link from "next/link";
import type { PublicSeasonRow } from "@/lib/seasons";

export function SeasonLinks({
  seasons,
  currentId,
  noun,
}: {
  seasons: Pick<PublicSeasonRow, "id" | "number" | "game" | "name">[];
  currentId: string | null;
  noun: string;
}) {
  if (seasons.length < 2) return null;
  return (
    <nav className="team-view-toggle team-season-tabs" aria-label={`Season ${noun}`}>
      {seasons.map((season) => {
        const on = season.id === currentId;
        return (
          <Link
            key={season.id}
            href={`?season=${season.game.toLowerCase()}-${season.number}`}
            className={on ? "active" : undefined}
            aria-current={on ? "page" : undefined}
            role="tab"
            aria-selected={on}
          >
            Season {season.number} {noun}
          </Link>
        );
      })}
    </nav>
  );
}
