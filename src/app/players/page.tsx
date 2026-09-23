import { Crown, Gem, Users } from "lucide-react";
import { PageHeader, StatTile } from "@/components/common";
import { PlayersGrid, type PlayerCardView } from "@/components/players-grid";
import { MEDAL_LABELS, MEDALS, type Medal } from "@/lib/constants";
import { getPlayers, formatRoles } from "@/lib/data";
import { toIso } from "@/lib/format";
import { PLAY_WINDOW_SHORT, playWindowOrBoth } from "@/lib/play-window";
import { isRosterSub } from "@/lib/roles";
import { getCurrentSeasonSafe } from "@/lib/seasons";
import { pageMeta } from "@/lib/seo";

export const revalidate = 30;

export const metadata = pageMeta(
  "Players",
  "Registered MM Dota Cup players, medals, roles, and team assignments for the indoor Dota 2 tournament.",
);

function medalRank(medal: string) {
  const i = (MEDALS as readonly string[]).indexOf(medal);
  return i === -1 ? MEDALS.length : i;
}

export default async function PlayersPage() {
  const [players, season] = await Promise.all([getPlayers(), getCurrentSeasonSafe()]);

  const views: PlayerCardView[] = players.map((p) => ({
    id: p.id,
    steamName: p.steamName,
    medal: p.medal,
    rolesLabel: formatRoles(p.roles),
    roleKeys: p.roles,
    teamId: p.teamId,
    teamName: p.team?.name ?? null,
    isCaptain: p.isCaptain,
    isSub: isRosterSub(p.rosterRole),
    basePrice: p.basePrice,
    playWindowLabel: PLAY_WINDOW_SHORT[playWindowOrBoth(p.playWindow)],
    createdAt: toIso(p.createdAt),
  }));

  const unsigned = views.filter((p) => !p.teamId).length;
  const captains = views.filter((p) => p.isCaptain).length;
  const topMedal = [...views].sort(
    (a, b) => medalRank(a.medal) - medalRank(b.medal),
  )[0];
  const topValue = [...views].sort((a, b) => b.basePrice - a.basePrice)[0];

  return (
    <div className="page players-list-page">
      <PageHeader
        className="players-list-hero"
        eyebrow={season ? `Season ${season.number}` : "Pool"}
        title="Players"
        pills={
          views.length > 0
            ? [
                { value: views.length, label: "registered" },
                { value: unsigned, label: "in auction pool" },
                {
                  value: captains,
                  label: `captain${captains === 1 ? "" : "s"}`,
                },
              ]
            : undefined
        }
      />

      {views.length > 0 ? (
        <ul className="mb-6 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-3">
          <li>
            <StatTile
              icon={<Gem />}
              label="Highest medal"
              value={
                topMedal
                  ? MEDAL_LABELS[topMedal.medal as Medal] ?? topMedal.medal
                  : "—"
              }
            />
          </li>
          <li>
            <StatTile
              icon={<Crown />}
              label="Top auction value"
              value={topValue ? topValue.basePrice.toLocaleString() : "—"}
            />
          </li>
          <li>
            <StatTile icon={<Users />} label="Captains" value={captains} />
          </li>
        </ul>
      ) : null}

      {views.length === 0 ? (
        <div className="empty-panel teams-list-empty">
          <span className="team-empty-matches-icon" aria-hidden>
            👤
          </span>
          <p className="muted" style={{ margin: 0 }}>
            No players registered.
          </p>
        </div>
      ) : (
        <PlayersGrid players={views} />
      )}
    </div>
  );
}
