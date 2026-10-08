import Link from "next/link";
import { PageHeader } from "@/components/common";
import { AdminSeasonViewer } from "@/components/admin/season-viewer";
import { requireAdmin } from "@/lib/admin-auth";
import { resolveAdminSeasonView } from "@/lib/admin-season-view";
import { adminListSoldLots, adminListTeamsForPicker } from "@/lib/match-admin";
import { pageMeta } from "@/lib/seo";
import { AdminAuctionBoard } from "@/components/admin/auction-board";
import { AdminAuctionDesk } from "@/components/admin/auction-desk";
import { CaptainCredentialsPanel } from "@/components/admin/captain-credentials-panel";
import { AdminCard, AdminSection } from "@/components/admin/ui";
import { listCaptainAccounts } from "@/lib/captain-accounts";
import { getWebAuctionView } from "@/lib/web-auction";
import { getLiveSeason } from "@/lib/seasons";
import { prisma } from "@/lib/prisma";
import { medalsForGame } from "@/lib/constants";
import { AUCTION_PLAYER_STATUS } from "@/lib/web-auction";

export const dynamic = "force-dynamic";
export const metadata = pageMeta(
  "Admin Auction",
  "Live auction desk, captain logins, and sold-lot fixes.",
);

export default async function AdminAuctionPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const seasonView = await resolveAdminSeasonView(sp.season);
  const [lots, view, season, teams, accounts] = await Promise.all([
    adminListSoldLots(seasonView.view.id),
    getWebAuctionView(),
    getLiveSeason(),
    adminListTeamsForPicker(seasonView.view.id),
    listCaptainAccounts(seasonView.view.id),
  ]);

  const poolRows = await prisma.seasonPlayer.findMany({
    where: { seasonId: seasonView.view.id, teamId: null },
    select: {
      player: {
        select: {
          id: true,
          steamName: true,
          medal: true,
          auctionStatus: true,
          basePrice: true,
        },
      },
    },
    orderBy: { player: { steamName: "asc" } },
    take: 80,
  });
  const pool = poolRows.map((row) => row.player);
  const viewingLive = seasonView.view.isLive && season?.id === seasonView.view.id;
  const format = viewingLive
    ? (season?.tournamentFormat ?? "AUCTION_BASED")
    : "AUCTION_BASED";

  return (
    <div className="page">
      <PageHeader
        eyebrow="Admin"
        title="Auction"
        subtitle="Live web desk for captains, credentials, and sold-lot corrections."
        pills={[
          { value: lots.length, label: "sold" },
          { value: pool.length, label: "unsigned" },
        ]}
        actions={
          <Link href="/auction/live" className="text-sm text-primary underline-offset-2 hover:underline">
            Public live board
          </Link>
        }
      />
      <AdminSeasonViewer
        view={seasonView.view}
        options={seasonView.options}
        readOnly={seasonView.readOnly}
        publicSeasonParam={seasonView.publicSeasonParam}
        publicHref="/auction"
      />

      <AdminCard tone="accent" className="mb-6">
        <AdminSection title="Live auction desk">
          {viewingLive ? (
            <AdminAuctionDesk
              view={view}
              format={format}
              medals={medalsForGame(seasonView.view.game)}
            />
          ) : (
            <p className="m-0 text-sm text-muted-foreground">
              The live bidding desk follows the active cup. This view lists sold
              players for the selected season only.
            </p>
          )}
        </AdminSection>
      </AdminCard>

      <AdminCard className="mb-6">
        <AdminSection title="Captain credentials">
          <p className="m-0 mb-3 text-sm text-muted-foreground">
            Generate single-purpose logins for the captain bid panel at{" "}
            <code>/auction/captain</code>.
          </p>
          <CaptainCredentialsPanel
            readOnly={seasonView.readOnly}
            teams={teams.map((t) => ({
              id: t.id,
              name: t.name,
              tag: t.tag ?? null,
            }))}
            accounts={accounts.map((a) => ({
              id: a.id,
              loginName: a.loginName,
              teamId: a.teamId,
              teamName: a.team.name,
            }))}
          />
        </AdminSection>
      </AdminCard>

      <AdminCard className="mb-6">
        <AdminSection title="Unsigned player pool">
          <ul className="m-0 grid list-none gap-1 p-0 text-sm">
            {pool.length === 0 ? (
              <li className="text-muted-foreground">No unsigned players.</li>
            ) : (
              pool.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap justify-between gap-2 border-b border-white/5 py-1.5"
                >
                  <span>
                    {p.steamName}{" "}
                    <span className="text-muted-foreground">({p.medal})</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {p.auctionStatus || AUCTION_PLAYER_STATUS.UNSOLD}
                    {p.basePrice != null ? ` · floor ${p.basePrice}` : ""}
                  </span>
                </li>
              ))
            )}
          </ul>
        </AdminSection>
      </AdminCard>

      <AdminCard>
        <AdminSection title="Sold lots (price fix)">
          <AdminAuctionBoard
            seasonId={seasonView.view.id}
            lots={lots.map((lot) => ({
              id: lot.id,
              playerName: lot.player.steamName,
              teamName: lot.team?.name ?? "—",
              soldPrice: lot.soldPrice ?? 0,
              purse: lot.team?.purse ?? 0,
            }))}
          />
        </AdminSection>
      </AdminCard>
    </div>
  );
}
