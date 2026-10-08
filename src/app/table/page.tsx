import { PageHeader } from "@/components/common";
import { GroupStandingsTable } from "@/components/group-standings";
import { StandingsBoard } from "@/components/standings-board";
import { SeasonArchiveBannerServer } from "@/components/season-archive-banner-server";
import {
  loadGroupStandingsForSeason,
  loadStandingsForSeason,
} from "@/lib/season-data";
import { getGroupStandings } from "@/lib/group-stage-schedule";
import { getStandings } from "@/lib/data";
import { getPublicSeasonContext } from "@/lib/season-page";
import { livePageMeta } from "@/lib/seo";
import { isPubgSeason, pubgModeLabel } from "@/lib/games";
import { pubgStandings } from "@/lib/pubg-lobby";
import { prisma } from "@/lib/prisma";

export const revalidate = 30;

export function generateMetadata() {
  return livePageMeta("League Standings", (brand) =>
    brand.game === "PUBG"
      ? `Live ${brand.name} points table: placement points plus kills for every team this season.`
      : `Live ${brand.name} standings: wins, losses, and points for every franchise this season.`,
  );
}

export default async function TablePage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sp = await searchParams;
  const { view, seasonId } = await getPublicSeasonContext(sp);
  const seasonRow = seasonId
    ? await prisma.season.findUnique({
        where: { id: seasonId },
        select: { game: true, pubgMode: true, name: true },
      })
    : null;
  if (seasonId && isPubgSeason(seasonRow)) {
    const rows = await pubgStandings(seasonId);
    return (
      <div className="page table-page">
        <SeasonArchiveBannerServer season={sp.season} />
        <PageHeader
          eyebrow={`${seasonRow?.name ?? "PUBG"} · ${pubgModeLabel(seasonRow?.pubgMode)}`}
          title="Points table"
          subtitle="1st is 10, then 6, 5, 4, 3, 2, and 1 for 7th–8th. Every kill is 1 point."
        />
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">WWCD</th>
                <th className="px-3 py-2">Place</th>
                <th className="px-3 py-2">Kills</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Games</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-muted-foreground">
                    No teams yet. Register, then captains fill the roster.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.teamId} className="border-t border-white/10">
                    <td className="px-3 py-2">{index + 1}</td>
                    <td className="px-3 py-2 font-medium">{row.name}</td>
                    <td className="px-3 py-2">{row.wwcd}</td>
                    <td className="px-3 py-2">{row.placementPoints}</td>
                    <td className="px-3 py-2">{row.killPoints}</td>
                    <td className="px-3 py-2 font-semibold">{row.total}</td>
                    <td className="px-3 py-2">{row.matches}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  const [groupA, groupB, overall] = await Promise.all([
    seasonId
      ? loadGroupStandingsForSeason(seasonId, "A")
      : getGroupStandings("A"),
    seasonId
      ? loadGroupStandingsForSeason(seasonId, "B")
      : getGroupStandings("B"),
    seasonId ? loadStandingsForSeason(seasonId) : getStandings(),
  ]);

  const views = overall.map((row) => ({
    id: row.id,
    name: row.name,
    played: row.played,
    wins: row.wins,
    losses: row.losses,
    points: row.points,
  }));

  const groupGames =
    groupA.reduce((n, r) => n + r.played, 0) +
    groupB.reduce((n, r) => n + r.played, 0);
  const hasGroups = groupA.length > 0 || groupB.length > 0;
  const markA =
    groupA.length === 4 && groupA.every((row) => row.played === 3);
  const markB =
    groupB.length === 4 && groupB.every((row) => row.played === 3);

  return (
    <div className="page table-page">
      <SeasonArchiveBannerServer season={sp.season} />
      <PageHeader
        eyebrow="Standings"
        title={view ? `Table · Season ${view.number}` : "Standings"}
        subtitle={
          hasGroups
            ? `${groupGames} group games counted toward placement. Overall table includes playoffs.`
            : "Team records update after each result is logged."
        }
        pills={
          views.length > 0
            ? [{ value: views.length, label: "teams" }]
            : undefined
        }
      />

      {hasGroups ? (
        <div className="group-standings-row-wrap">
          <GroupStandingsTable
            title="Group A"
            rows={groupA}
            markLastEliminated={markA}
          />
          <GroupStandingsTable
            title="Group B"
            rows={groupB}
            markLastEliminated={markB}
          />
        </div>
      ) : null}

      <StandingsBoard rows={views} />
    </div>
  );
}
