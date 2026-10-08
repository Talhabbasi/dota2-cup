import { PageHeader } from "@/components/common";
import { CupScheduleBoard } from "@/components/cup-schedule";
import { GroupStandingsTable } from "@/components/group-standings";
import { SeasonArchiveBannerServer } from "@/components/season-archive-banner-server";
import { loadGroupStandingsForSeason } from "@/lib/season-data";
import { getPublicSeasonContext } from "@/lib/season-page";
import { listCupSchedule } from "@/lib/schedule-crud";
import { listPubgLobbies } from "@/lib/pubg-lobby";
import { livePageMeta } from "@/lib/seo";
import { seasonScheduleSubtitle } from "@/lib/season-public-copy";

export const revalidate = 30;

export function generateMetadata() {
  return livePageMeta("Match Schedule", (brand) =>
    brand.game === "PUBG"
      ? `${brand.name} lobby schedule in Pakistan time — booked PUBG lobbies and maps.`
      : `Weekend ${brand.name} fixtures in Pakistan time — group stage, playoffs, and upcoming Dota 2 kickoffs.`,
  );
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sp = await searchParams;
  const { view, seasonId } = await getPublicSeasonContext(sp);
  if (view?.game === "PUBG" && seasonId) {
    const lobbies = (await listPubgLobbies(seasonId)).filter(
      (lobby) => lobby.status === "scheduled",
    );
    return (
      <div className="page schedule-page">
        <SeasonArchiveBannerServer season={sp.season} />
        <PageHeader
          eyebrow="Fixtures"
          title={`${view.name} · schedule`}
          subtitle="Booked PUBG lobbies for the active season."
        />
        {lobbies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No lobbies booked yet.</p>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {lobbies.map((lobby) => (
              <li key={lobby.id} className="rounded-lg border border-white/10 px-4 py-3">
                <p className="m-0 font-medium">
                  {lobby.label || "Lobby"} · {lobby.map}
                </p>
                <p className="mt-1 mb-0 text-sm text-muted-foreground">
                  {lobby.playedAt.toLocaleString("en-PK", { timeZone: "Asia/Karachi" })} PKT
                  {" · "}
                  {lobby.teams.map((row) => row.team.name).join(", ") || "Teams not listed"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  const [fixtures, groupA, groupB] = await Promise.all([
    listCupSchedule({ publicOnly: true, seasonId: seasonId ?? undefined }),
    seasonId
      ? loadGroupStandingsForSeason(seasonId, "A")
      : Promise.resolve([]),
    seasonId
      ? loadGroupStandingsForSeason(seasonId, "B")
      : Promise.resolve([]),
  ]);
  const upcoming = fixtures.filter((fixture) => fixture.status === "scheduled");
  const groupSize = view?.teamCount ? Math.max(2, Math.floor(view.teamCount / 2)) : 4;
  const subtitle = view
    ? seasonScheduleSubtitle({
        number: view.number,
        name: view.name,
        teamCount: view.teamCount,
        tournamentFormat: view.tournamentFormat,
        plannedStartAt: view.plannedStartAt,
        startedAt: view.startedAt,
        phase: view.phase,
      })
    : "Group A Saturday, Group B Sunday, then weekend playoffs. Kickoffs follow fixtures booked in admin (PKT).";

  return (
    <div className="page schedule-page">
      <SeasonArchiveBannerServer season={sp.season} />
      <PageHeader
        eyebrow="Fixtures"
        title={view ? `Schedule · Season ${view.number}` : "Schedule"}
        subtitle={subtitle}
        pills={
          fixtures.length > 0
            ? [
                { value: upcoming.length, label: "upcoming" },
                {
                  value: fixtures.length - upcoming.length,
                  label: "played",
                },
                ...(view
                  ? [{ value: view.teamCount, label: "planned teams" }]
                  : []),
              ]
            : view
              ? [{ value: view.teamCount, label: "planned teams" }]
              : undefined
        }
      />
      <div className="group-standings-row-wrap">
        <GroupStandingsTable
          title="Group A"
          rows={groupA}
          markLastEliminated={
            groupA.length === groupSize &&
            groupA.every((row) => row.played === groupSize - 1)
          }
        />
        <GroupStandingsTable
          title="Group B"
          rows={groupB}
          markLastEliminated={
            groupB.length === groupSize &&
            groupB.every((row) => row.played === groupSize - 1)
          }
        />
      </div>
      <CupScheduleBoard fixtures={fixtures} />
    </div>
  );
}
