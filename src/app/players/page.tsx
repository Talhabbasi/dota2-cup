import { Crown, Gem, Users } from "lucide-react";
import { PageHeader, StatTile } from "@/components/common";
import { PlayersGrid, type PlayerCardView } from "@/components/players-grid";
import { SeasonArchiveBannerServer } from "@/components/season-archive-banner-server";
import { MEDAL_LABELS, MEDALS, type Medal } from "@/lib/constants";
import { formatRoles } from "@/lib/data";
import { toIso } from "@/lib/format";
import { PLAY_WINDOW_SHORT, playWindowOrBoth } from "@/lib/play-window";
import { isRosterSub } from "@/lib/roles";
import { loadPlayersForSeason } from "@/lib/season-data";
import { getPublicSeasonContext } from "@/lib/season-page";
import { pageMeta } from "@/lib/seo";
import { CUP_NAME } from "@/lib/brand";
import { formatSeasonStartDate, seasonPlanLine } from "@/lib/season-constants";

export const revalidate = 30;

export const metadata = pageMeta(
  "Players",
  `Registered ${CUP_NAME} players, medals, roles, and team assignments for the indoor Dota 2 tournament.`,
);

function medalRank(medal: string) {
  const i = (MEDALS as readonly string[]).indexOf(medal);
  return i === -1 ? MEDALS.length : i;
}

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sp = await searchParams;
  const { view, seasonId } = await getPublicSeasonContext(sp);
  const players = seasonId ? await loadPlayersForSeason(seasonId) : [];

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
    createdAt: typeof p.createdAt === "string" ? p.createdAt : toIso(p.createdAt),
  }));

  const unsigned = views.filter((p) => !p.teamId).length;
  const captains = views.filter((p) => p.isCaptain).length;
  const topMedal = [...views].sort(
    (a, b) => medalRank(a.medal) - medalRank(b.medal),
  )[0];
  const topValue = [...views].sort((a, b) => b.basePrice - a.basePrice)[0];

  return (
    <div className="page players-list-page">
      <SeasonArchiveBannerServer season={sp.season} />
      <PageHeader
        className="players-list-hero"
        eyebrow={
          view
            ? seasonPlanLine({
                number: view.number,
                teamCount: view.teamCount,
                plannedStartAt: view.plannedStartAt,
                startedAt: view.startedAt,
                phase: view.phase,
              })
            : "Pool"
        }
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
            {view
              ? `No players registered for Season ${view.number} yet${
                  formatSeasonStartDate(view.plannedStartAt)
                    ? ` · starts ${formatSeasonStartDate(view.plannedStartAt)}`
                    : ""
                }. Returning players keep the same Steam account — register again on the site or Discord (or ask an admin to link them) to appear here.`
              : "No players registered for the live season yet."}
          </p>
        </div>
      ) : (
        <PlayersGrid players={views} />
      )}
    </div>
  );
}
