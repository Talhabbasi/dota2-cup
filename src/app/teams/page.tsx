import { PageHeader } from "@/components/common";
import {
  TeamSeasonTabs,
  type TeamCardView,
  type TeamSeasonSection,
} from "@/components/teams-grid";
import { SeasonArchiveBannerServer } from "@/components/season-archive-banner-server";
import { loadTeamsForSeason } from "@/lib/season-data";
import { getPublicSeasonContext } from "@/lib/season-page";
import { isRosterSub, parseRolesJson } from "@/lib/roles";
import { livePageMeta } from "@/lib/seo";
import { seasonPlanLine } from "@/lib/season-constants";
import { seasonEmptyTeamsCopy } from "@/lib/season-public-copy";
import { showcaseRole } from "@/lib/team-portraits";
import { CUP_GAME, type CupGame } from "@/lib/games";
import type { PublicSeasonRow } from "@/lib/seasons";

export const revalidate = 30;

export function generateMetadata() {
  return livePageMeta(
    "Teams & Rosters",
    (brand) =>
      `Franchises from every ${brand.name} season — captains, rosters, and records.`,
  );
}

function seasonHeading(season: PublicSeasonRow) {
  const game = season.game === "PUBG" ? "PUBG" : "Dota";
  return season.name !== `Season ${season.number}`
    ? `${game} · ${season.name}`
    : `${game} Season ${season.number}`;
}

async function cardsForSeason(seasonId: string): Promise<TeamCardView[]> {
  const teams = await loadTeamsForSeason(seasonId);
  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    players: team.players
      .filter((player) => !isRosterSub(player.rosterRole))
      .slice(0, 5)
      .map((player) => ({
        id: player.id,
        avatarConfig: player.avatarConfig,
        name: player.profileName.trim() || player.steamName,
        role: showcaseRole(parseRolesJson(player.rolesJson ?? "[]")),
      })),
  }));
}

export async function TeamsScreen({
  searchParams,
  game,
}: {
  searchParams: { season?: string };
  game?: CupGame;
}) {
  const { seasons } = await getPublicSeasonContext(searchParams, game);
  const sections: TeamSeasonSection[] = await Promise.all(
    seasons.map(async (season) => ({
      id: season.id,
      label: `Season ${season.number} teams`,
      note: `${seasonHeading(season)} · ${seasonPlanLine({
        number: season.number,
        teamCount: season.teamCount,
        plannedStartAt: season.plannedStartAt,
        startedAt: season.startedAt,
        phase: season.phase,
      })}${season.championName ? ` · Champion ${season.championName}` : ""}`,
      teams: await cardsForSeason(season.id),
      empty: seasonEmptyTeamsCopy(season),
    })),
  );
  const label = seasons[0]?.game === CUP_GAME.PUBG ? "PUBG" : "Dota";

  return (
    <div className="page teams-list-page">
      <SeasonArchiveBannerServer season={searchParams.season} />
      <PageHeader
        eyebrow={label}
        title="Teams"
        subtitle="Open a season tab. Each franchise is its roster, name and role only."
      />

      {sections.length === 0 ? (
        <div className="empty-panel teams-list-empty">
          <p className="muted" style={{ margin: 0 }}>
            No seasons for this game yet.
          </p>
        </div>
      ) : (
        <TeamSeasonTabs sections={sections} />
      )}
    </div>
  );
}

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sp = await searchParams;
  return <TeamsScreen searchParams={sp} />;
}
