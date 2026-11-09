import { PageHeader } from "@/components/common";
import { SeasonArchiveBannerServer } from "@/components/season-archive-banner-server";
import { SeasonSwitch } from "@/components/season-switch";
import { CUP_GAME } from "@/lib/games";
import { pubgStandings } from "@/lib/pubg-lobby";
import { getPublicSeasonContext } from "@/lib/season-page";

export const revalidate = 30;

export const metadata = {
  title: "Points table",
};

function seasonNote(season: { number: number; name: string }) {
  return season.name && season.name !== `Season ${season.number}`
    ? season.name
    : `PUBG Season ${season.number}`;
}

export default async function PubgTablePage() {
  const { seasons } = await getPublicSeasonContext(undefined, CUP_GAME.PUBG);
  const blocks = await Promise.all(
    seasons.map(async (season) => ({
      season,
      rows: await pubgStandings(season.id),
    })),
  );

  return (
    <div className="page table-page">
      <SeasonArchiveBannerServer />
      <PageHeader
        eyebrow="PUBG"
        title="Points table"
        subtitle="Each tab is one PUBG season. 1st is 10, then 6, 5, 4, 3, 2, and 1 for 7th–8th. Every kill is 1 point."
      />
      {blocks.length === 0 ? (
        <p className="m-0 text-sm text-muted-foreground">No PUBG season yet.</p>
      ) : (
        <SeasonSwitch
          ariaLabel="Season tables"
          labels={blocks.map((block) => `Season ${block.season.number} table`)}
          notes={blocks.map((block) => seasonNote(block.season))}
        >
          {blocks.map(({ season, rows }) => (
            <div key={season.id} className="overflow-x-auto rounded-lg border border-white/10">
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
                        No teams in this season yet.
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
          ))}
        </SeasonSwitch>
      )}
    </div>
  );
}
